import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@sheet-engine/react';
import { WorkbookInstance } from '@sheet-engine/react';
import { jfrefreshgrid } from '@sheet-engine/core';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';
import { CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';
import { useLiveQuery } from './live-query/use-live-query';
import { DataBlockApiKeyHandlerType } from '../types';
import { ySheetArrayToPlain } from '../utils/update-ydoc';
import { migrateSheetArrayIfNeeded } from '../utils/migrate-new-yjs';

type CelldataEntry = { r: number; c: number; v: unknown };

/**
 * Patch sparse Yjs celldata into an existing sheet snapshot (keeps the live `data` grid).
 * Applying sparse `celldata` alone via updateSheet() rebuilds the matrix from only patched
 * cells and clears everything else.
 */
function mergeYdocCelldataIntoSheets(
  baseSheets: Sheet[],
  ydocSheets: Sheet[],
): Sheet[] {
  const patchesBySheetId = new Map<string, CelldataEntry[]>();
  for (const sheet of ydocSheets) {
    const id = sheet?.id as string | undefined;
    if (!id || !sheet.celldata?.length) continue;
    patchesBySheetId.set(id, sheet.celldata as CelldataEntry[]);
  }
  if (patchesBySheetId.size === 0) return baseSheets;

  const merged = baseSheets.map((sheet) => {
    const id = sheet?.id as string | undefined;
    if (!id) return sheet;
    const patches = patchesBySheetId.get(id);
    if (!patches?.length) return sheet;

    const data: unknown[][] = Array.isArray(sheet.data)
      ? sheet.data.map((row) => (Array.isArray(row) ? [...row] : []))
      : [];

    for (const cell of patches) {
      const { r, c, v } = cell;
      if (typeof r !== 'number' || typeof c !== 'number') continue;
      while (data.length <= r) data.push([]);
      while (data[r].length <= c) data[r].push(null);
      data[r][c] = v;
    }

    patchesBySheetId.delete(id);
    return { ...sheet, data: data as Sheet['data'] };
  });

  for (const [id, patches] of patchesBySheetId) {
    const ydocSheet = ydocSheets.find((s) => s.id === id);
    if (!ydocSheet) continue;
    merged.push(mergeYdocCelldataIntoSheets([], [ydocSheet])[0] ?? ydocSheet);
  }

  return merged;
}

/**
 * Hook for managing sheet data
 * Handles initialization, updates, and persistence of sheet data
 */

export const useEditorData = (
  ydocRef: React.MutableRefObject<Y.Doc | null>,
  dsheetId: string,
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>,
  portalContent?: string,
  isReadOnly = false,
  onChange?: (data: Sheet[]) => void,
  syncStatus?: 'initializing' | 'syncing' | 'synced' | 'error',
  commentData?: object,
  // @ts-ignore
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } },
  setDataBlockCalcFunction?: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >,
  enableLiveQuery = false,
  liveQueryRefreshRate?: number,
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType,
  allowComments?: boolean,
) => {
  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const currentDataRef = useRef<Sheet[]>([]);
  const remoteUpdateRef = useRef<boolean>(false);
  const dataInitialized = useRef<boolean>(false);
  const isUpdatingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  /** Last applied `portalContent` string; reset when `dsheetId` changes. */
  const lastAppliedPortalContentRef = useRef<string | null>(null);

  useEffect(() => {
    lastAppliedPortalContentRef.current = null;
  }, [dsheetId]);

  const { handleLiveQuery, initialiseLiveQueryData } = useLiveQuery(
    sheetEditorRef,
    dataBlockApiKeyHandler,
    enableLiveQuery,
    liveQueryRefreshRate,
  );

  // Apply portal content when it changes (initial load + portal refresh / multi-device sync)
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current) {
      return;
    }
    if (portalContent === lastAppliedPortalContentRef.current) {
      return;
    }

    try {
      const incoming = toUint8Array(portalContent);
      const ydoc = ydocRef.current;

      // Bring `ydoc` toward the target state without re-applying shared history twice.
      // Parent may send a merged update blob; diffing vs current SV is correct for IDB-hydrated ydocs too.
      const sv = Y.encodeStateVector(ydoc);
      const targetDoc = new Y.Doc();
      Y.applyUpdate(targetDoc, incoming);
      const delta = Y.encodeStateAsUpdate(targetDoc, sv);
      targetDoc.destroy();

      if (delta.byteLength > 0) {
        Y.applyUpdate(ydoc, delta);
      }

      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, incoming);

      const internalDsheetId = [...tempDoc.share.keys()][0];
      // Use main ydoc's sheet array so migration persists; migrating tempDoc's
      // array left the main doc unmigrated and caused "t.forEach is not a function"
      // when the library read plain-object sheet items.
      const sheetArray = ydocRef.current.getArray(internalDsheetId);

      // Migrate legacy sheet array to Y.Map-based structure if needed
      migrateSheetArrayIfNeeded(ydocRef.current, sheetArray);

      // Convert Yjs sheet array to plain snapshot for Fortune spreadsheet
      const newSheetData = ySheetArrayToPlain(
        // @ts-ignore
        sheetArray as Y.Array<Y.Map>,
      );

      currentDataRef.current = newSheetData;
      initialiseLiveQueryData(newSheetData);

      lastAppliedPortalContentRef.current = portalContent;

      if (setForceSheetRender) {
        setForceSheetRender((prev) => prev + 1);
      }

      const dataBlockList: { [key: string]: any } = {};
      newSheetData.forEach((sheet: Sheet) => {
        if (sheet?.id && sheet?.dataBlockCalcFunction) {
          dataBlockList[sheet.id] = {
            ...sheet.dataBlockCalcFunction,
          };
        }
      });
      //@ts-ignore
      setDataBlockCalcFunction?.(dataBlockList);

      tempDoc.destroy();
    } catch (error) {
      console.error('[DSheet] Error processing portal content:', error);
    }
  }, [portalContent]);

  // Apply comment data if provided (do this before any other initialization)
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) {
      return;
    }
    try {
      const currentDocData = ydocRef.current.getArray(dsheetId);
      const currentData = ySheetArrayToPlain(
        // @ts-ignore
        currentDocData as Y.Array<Y.Map>,
      );
      if (currentData.length > 0 && syncStatus === 'synced') {
        const setContext = sheetEditorRef?.current?.getWorkbookSetContext();
        if (sheetEditorRef.current !== null && setContext) {
          setContext?.((ctx: any) => {
            const files = ctx.luckysheetfile;
            files.forEach((file: any, fileIndex: number) => {
              const sheetKey =
                (file?.id ?? fileIndex)?.toString?.() ?? String(fileIndex);
              file.data?.forEach((row: any, rowIndex: number) => {
                row.forEach((cell: any, colIndex: number) => {
                  if (cell) {
                    const comment =
                      (commentData as any)?.[
                      `${sheetKey}_${rowIndex}_${colIndex}`
                      ] ??
                      (commentData as any)?.[
                      `${fileIndex}_${rowIndex}_${colIndex}`
                      ];
                    if (comment) {
                      cell.ps = allowComments
                        ? CELL_COMMENT_DEFAULT_VALUE
                        : undefined;
                    } else {
                      cell.ps = undefined;
                    }
                  }
                });
              });
            });
          });
        }
        //handle if data is synced but editor is not rendered/loaded. Usally happens on when allowComments is false on viewerside
        if (sheetEditorRef.current === null && syncStatus === 'synced') {
          const updatedSheets = currentData.map((sheet, index) => {
            const sheetKey = (sheet as any)?.id?.toString?.() ?? String(index);
            const updatedCelldata = (sheet.celldata || []).map((cell: any) => {
              const comment =
                (commentData as any)?.[`${sheetKey}_${cell.r}_${cell.c}`] ??
                (commentData as any)?.[`${index}_${cell.r}_${cell.c}`];
              if (!cell?.v) return cell;
              return {
                ...cell,
                v: {
                  ...cell.v,
                  ps: comment
                    ? !allowComments
                      ? undefined
                      : CELL_COMMENT_DEFAULT_VALUE
                    : undefined,
                },
              };
            });

            return { ...sheet, celldata: updatedCelldata };
          });

          currentDataRef.current = updatedSheets;
          if (setForceSheetRender) {
            setForceSheetRender((prev) => prev + 1);
          }
        }
      }
    } catch (error) {
      console.error('[DSheet] Error processing comment data:', error);
    }
  }, [
    commentData,
    dsheetId,
    ydocRef,
    isReadOnly,
    isDataLoaded,
    setIsDataLoaded,
    portalContent,
    allowComments,
    syncStatus,
  ]);

  // Initialize sheet data AFTER sync is complete - BUT ONLY IF NOT IN READ-ONLY MODE or if we have no data yet
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) {
      return;
    }

    // Only proceed with initialization if we've synced
    if (syncStatus === 'synced') {
      const initializeWithDefaultData = () => {
        // If we've already initialized (either here or via portal content), don't do it again
        if (dataInitialized.current) {
          return;
        }

        const sheetArray = ydocRef.current?.getArray(dsheetId);
        const currentData = Array.from(sheetArray || []) as Sheet[];
        initialiseLiveQueryData(currentData);

        dataInitialized.current = true;
        setIsDataLoaded(true);
      };

      initializeWithDefaultData();
    }
  }, [dsheetId, isReadOnly, syncStatus]);

  /** Optional hook after remote Yjs state is applied to `currentDataRef` (e.g. portal persist). */
  const onRemoteWorkbookAppliedRef = useRef<(() => void) | undefined>(
    undefined,
  );

  /**
   * Rebuild the plain sheet snapshot from Yjs and remount Workbook.
   * Used for collaboration (nested celldata Y.Map edits do not fire Y.Array observers).
   */
  const refreshWorkbookFromRemoteYdoc = useCallback(
    (options?: { onApplied?: () => void }) => {
      if (options?.onApplied) {
        onRemoteWorkbookAppliedRef.current = options.onApplied;
      }

      remoteUpdateRef.current = true;

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        const ydoc = ydocRef.current;
        if (!ydoc || !dsheetId) {
          debounceTimerRef.current = null;
          return;
        }

        let ydocPlain: Sheet[] = [];
        try {
          const sheetArray = ydoc.getArray(dsheetId);
          ydocPlain = ySheetArrayToPlain(sheetArray as any);
        } catch (e) {
          console.error(
            '[DSheet] refreshWorkbookFromRemoteYdoc: ySheetArrayToPlain failed',
            e,
          );
          debounceTimerRef.current = null;
          return;
        }

        const workbook = sheetEditorRef.current;
        const baseSheets =
          (workbook?.getAllSheets?.() as Sheet[] | undefined) ??
          currentDataRef.current ??
          [];
        const merged = mergeYdocCelldataIntoSheets(baseSheets, ydocPlain);
        currentDataRef.current = merged;
        initialiseLiveQueryData(merged);

        let patchedViaSetCellValue = 0;
        const canPatchCells = Boolean(
          workbook && typeof workbook.setCellValue === 'function',
        );

        if (canPatchCells) {
          try {
            console.log(
              'refreshWorkbookFromRemoteYdoc setCellValue',
              ydocPlain,
            );
            for (const sheet of ydocPlain) {
              const sheetId = sheet.id as string | undefined;
              if (!sheetId) continue;
              for (const cell of sheet.celldata ?? []) {
                if (typeof cell.r !== 'number' || typeof cell.c !== 'number') {
                  continue;
                }
                workbook!.setCellValue(
                  cell.r,
                  cell.c,
                  cell.v,
                  { id: sheetId },
                  false,
                );
                patchedViaSetCellValue += 1;
              }
            }
            const live = workbook?.getAllSheets?.() as Sheet[] | undefined;
            if (live?.length) {
              currentDataRef.current = live;
            }
            const setContext = workbook?.getWorkbookSetContext?.();
            if (setContext) {
              setContext((draftCtx) => {
                try {
                  jfrefreshgrid(draftCtx, null, undefined, false);
                } catch {
                  // Best-effort canvas repaint after remote cell patches.
                }
              });
            }
          } catch (e) {
            console.error(
              '[DSheet] refreshWorkbookFromRemoteYdoc: setCellValue patch failed',
              e,
            );
            if (typeof workbook?.updateSheet === 'function') {
              workbook.updateSheet(merged);
            } else if (setForceSheetRender) {
              setForceSheetRender((prev) => prev + 1);
            }
          }
        } else if (typeof workbook?.updateSheet === 'function') {
          try {
            workbook.updateSheet(merged);
          } catch (e) {
            console.error(
              '[DSheet] refreshWorkbookFromRemoteYdoc: updateSheet failed, remounting',
              e,
            );
            if (setForceSheetRender) {
              setForceSheetRender((prev) => prev + 1);
            }
          }
        } else if (setForceSheetRender) {
          setForceSheetRender((prev) => prev + 1);
        }

        onRemoteWorkbookAppliedRef.current?.();
        onRemoteWorkbookAppliedRef.current = undefined;
        debounceTimerRef.current = null;
      }, 50);
    },
    [
      ydocRef,
      dsheetId,
      setForceSheetRender,
      initialiseLiveQueryData,
      sheetEditorRef,
    ],
  );

  // React to remote collab applies (including nested celldata Y.Map changes).
  useEffect(() => {
    const ydoc = ydocRef.current;
    if (!ydoc || !dsheetId) return;

    const onYdocUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') return;
      console.log('onYdocUpdate remote');
      refreshWorkbookFromRemoteYdoc();
    };

    ydoc.on('update', onYdocUpdate);
    return () => {
      ydoc.off('update', onYdocUpdate);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [ydocRef, dsheetId, refreshWorkbookFromRemoteYdoc]);

  // Handle changes to the sheet
  const handleChange = useCallback(
    (_data: Sheet[]) => {
      if (remoteUpdateRef.current) {
        remoteUpdateRef.current = false;
        return;
      }

      // Set the flag to indicate we're in the process of updating YJS
      isUpdatingRef.current = true;

      // Reset the flag after a short delay to allow the update to complete
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);
    },
    [dsheetId, onChange],
  );

  return {
    sheetData,
    setSheetData,
    currentDataRef,
    remoteUpdateRef,
    isDataLoaded,
    setIsDataLoaded,
    handleChange,
    handleLiveQuery,
    initialiseLiveQueryData,
    refreshWorkbookFromRemoteYdoc,
  };
};
