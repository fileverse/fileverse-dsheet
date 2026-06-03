/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@sheet-engine/react';
import { WorkbookInstance } from '@sheet-engine/react';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';
import { CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';
import { useLiveQuery } from './live-query/use-live-query';
import { DataBlockApiKeyHandlerType } from '../types';
import { ySheetArrayToPlain } from '../utils/update-ydoc';
import { migrateSheetArrayIfNeeded } from '../utils/migrate-new-yjs';

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
  hasCollabContentInitialised?: boolean,
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

  // Initialize sheet data once Socket.IO collab sync reaches 'ready' for the first time.
  // The ydoc already contains the merged server state at this point.
  useEffect(() => {
    if (!hasCollabContentInitialised || !ydocRef.current || !dsheetId) return;
    if (dataInitialized.current) return;

    try {
      const sheetArray = ydocRef.current.getArray(dsheetId);
      migrateSheetArrayIfNeeded(ydocRef.current, sheetArray);

      // @ts-ignore
      const plain = ySheetArrayToPlain(sheetArray as Y.Array<Y.Map>);
      currentDataRef.current = plain;
      initialiseLiveQueryData(plain);

      const dataBlockList: { [key: string]: any } = {};
      plain.forEach((sheet: Sheet) => {
        if (sheet?.id && sheet?.dataBlockCalcFunction) {
          dataBlockList[sheet.id] = { ...sheet.dataBlockCalcFunction };
        }
      });
      // @ts-ignore
      setDataBlockCalcFunction?.(dataBlockList);

      dataInitialized.current = true;
      setIsDataLoaded(true);

      if (setForceSheetRender) {
        setForceSheetRender((prev) => prev + 1);
      }
    } catch (error) {
      console.error('[DSheet] Error initialising collab sheet data:', error);
    }
  }, [hasCollabContentInitialised]);

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

  // Attach listener for YJS data changes
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) return;
    const sheetArray = ydocRef.current.getArray(dsheetId);

    // How many cell changes to handle surgically before falling back to a full remount.
    // Large batches (paste, import, formula recalc) are cheaper as a single remount
    // than N individual setContext calls.
    const SURGICAL_CELL_LIMIT = 50;

    /** Top-level sheet Y.Map fields that can be applied without a Workbook remount. */
    const SURGICAL_SHEET_META_KEYS = new Set([
      'name',
      'order',
      'status',
      'color',
      'hide',
      'showGridLines',
    ]);

    /** True only when a sheet tab is inserted/removed on the top-level Y.Array. */
    const isSheetTabArrayChange = (event: Y.YEvent<any>): boolean => {
      const path = event.path;
      if (path.length !== 1 || typeof path[0] !== 'number') return false;
      if (!(event.target instanceof Y.Array)) return false;
      try {
        return event.delta.some(
          (op) => op.insert !== undefined || op.delete !== undefined,
        );
      } catch {
        return false;
      }
    };

    // Update local state when YJS data changes.
    // observeDeep (not observe) is required so that nested Y.Map mutations —
    // e.g. celldata.set('0_0', value) inside a sheet Y.Map — also trigger a
    // re-render. observe only fires for top-level array insertions/deletions
    // (tab add/remove) and would silently miss all remote cell edits.
    const observerCallback = (
      events: Y.YEvent<any>[],
      transaction: Y.Transaction,
    ) => {
      // Only react to remote Yjs updates. Local edits are already reflected in Workbook state,
      // and rebuilding a full plain snapshot on every local transaction is expensive.
      if (transaction.local || isUpdatingRef.current) return;

      remoteUpdateRef.current = true;

      // --- Classify events: cell-only vs structural ---
      type CellBatch = {
        sheetId: string;
        celldataMap: Y.Map<any>;
        changedKeys: Map<string, { action: string }>;
      };
      const cellBatches: CellBatch[] = [];
      const sheetMetaUpdates = new Map<
        string,
        { sheetId: string; sheetMap: Y.Map<any>; changedKeys: string[] }
      >();
      const indexOnlyEvents: Y.YEvent<any>[] = [];
      let hasStructural = false;
      const sheetsArr = sheetArray.toArray();

      for (const event of events) {
        const path = event.path;
        // path = [sheetArrayIndex, 'celldata'] for a Y.Map cell change
        if (
          path.length === 2 &&
          path[1] === 'celldata' &&
          typeof path[0] === 'number'
        ) {
          const sheetMap = sheetsArr[path[0] as number];
          if (!(sheetMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          const sheetId = sheetMap.get('id') as string;
          const celldataMap = sheetMap.get('celldata');
          if (!(celldataMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          cellBatches.push({
            sheetId,
            celldataMap,
            changedKeys: (event as Y.YMapEvent<any>).changes.keys,
          });
        } else if (
          path.length === 2 &&
          typeof path[0] === 'number' &&
          typeof path[1] === 'string' &&
          SURGICAL_SHEET_META_KEYS.has(path[1])
        ) {
          const sheetMap = sheetsArr[path[0] as number];
          if (!(sheetMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          const sheetId = sheetMap.get('id') as string;
          if (!sheetId) {
            hasStructural = true;
            continue;
          }
          sheetMetaUpdates.set(sheetId, {
            sheetId,
            sheetMap,
            changedKeys: [path[1] as string],
          });
        } else if (isSheetTabArrayChange(event)) {
          hasStructural = true;
        } else if (path.length === 1 && typeof path[0] === 'number') {
          const sheetMap = sheetsArr[path[0] as number];
          if (sheetMap instanceof Y.Map) {
            const changedKeys = Array.from(
              (event as Y.YMapEvent<any>).keys.keys(),
            );
            if (
              changedKeys.length > 0 &&
              changedKeys.every((k) => SURGICAL_SHEET_META_KEYS.has(k))
            ) {
              // color/hide have no imperative WorkbookInstance API — must remount.
              if (changedKeys.some((k) => k === 'color' || k === 'hide')) {
                hasStructural = true;
                continue;
              }
              const sheetId = sheetMap.get('id') as string;
              if (sheetId) {
                const existing = sheetMetaUpdates.get(sheetId);
                sheetMetaUpdates.set(sheetId, {
                  sheetId,
                  sheetMap,
                  changedKeys: existing
                    ? [...existing.changedKeys, ...changedKeys]
                    : changedKeys,
                });
                continue;
              }
            }
          }
          // Bubbling [sheetIndex] alongside nested celldata — resolved after the loop.
          indexOnlyEvents.push(event);
          continue;
        } else {
          hasStructural = true;
        }
      }

      for (const event of indexOnlyEvents) {
        if (cellBatches.length > 0 || sheetMetaUpdates.size > 0) continue;
        const changedKeys = Array.from((event as Y.YMapEvent<any>).keys.keys());
        if (changedKeys.length === 0) continue;
        hasStructural = true;
      }

      const totalCells = cellBatches.reduce(
        (n, b) => n + b.changedKeys.size,
        0,
      );

      const applyRemoteSheetMeta = () => {
        const orderList: Record<string, number> = {};
        let hasOrderChange = false;

        for (const { sheetId, sheetMap, changedKeys } of sheetMetaUpdates.values()) {
          if (changedKeys.includes('name')) {
            const name = sheetMap.get('name');
            if (typeof name === 'string') {
              sheetEditorRef.current?.setSheetName?.(name, { id: sheetId });
            }
          }
          if (changedKeys.includes('order')) {
            const order = sheetMap.get('order');
            if (typeof order === 'number') {
              orderList[sheetId] = order;
              hasOrderChange = true;
            }
          }
        }

        if (hasOrderChange) {
          sheetEditorRef.current?.setSheetOrder?.(orderList);
        }
      };

      // --- Fall back to remount for structural changes or large cell batches ---
      if (
        hasStructural ||
        totalCells > SURGICAL_CELL_LIMIT ||
        !sheetEditorRef.current
      ) {
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          // Keep `currentDataRef` aligned with Yjs before forcing a Workbook remount.
          // Otherwise `EditorWorkbook` re-inits from a stale plain snapshot (e.g. formula
          // cells cleared on import) and wipes values that were just written by recalc + ydoc.
          const isEditingCell =
            (sheetEditorRef.current?.getWorkbookContext?.()
              ?.luckysheetCellUpdate?.length ?? 0) > 0;
          try {
            const plain = ySheetArrayToPlain(sheetArray as any);
            currentDataRef.current = plain;
          } catch (e) {
            console.error(
              '[DSheet] ySheetArrayToPlain after ydoc observe failed',
              e,
            );
          }
          // Avoid forcing a full Workbook remount while in-cell editing is active.
          // Remounting mid-edit can temporarily re-apply stale cell styles (e.g. alignment)
          // and cause a visible flicker.
          if (!isEditingCell && setForceSheetRender) {
            setForceSheetRender((prev) => prev + 1);
          }
          debounceTimerRef.current = null;
        }, 50);
        return;
      }

      if (sheetMetaUpdates.size > 0) {
        applyRemoteSheetMeta();
      }

      if (totalCells === 0 && sheetMetaUpdates.size > 0) {
        try {
          const plain = ySheetArrayToPlain(sheetArray as any);
          currentDataRef.current = plain;
        } catch (e) {
          console.error(
            '[DSheet] ySheetArrayToPlain after remote sheet meta failed',
            e,
          );
        }
        return;
      }

      // --- Surgical path: imperative per-cell updates, zero Workbook remount ---
      // callAfterUpdate=false prevents afterUpdateCell hook from writing the
      // remote value back into ydoc, which would create an update loop.
      for (const { sheetId, celldataMap, changedKeys } of cellBatches) {
        changedKeys.forEach(({ action }, key) => {
          const sep = key.lastIndexOf('_');
          const r = parseInt(key.slice(0, sep), 10);
          const c = parseInt(key.slice(sep + 1), 10);

          if (action === 'delete') {
            sheetEditorRef.current?.setCellValue(
              r,
              c,
              null,
              { id: sheetId },
              false,
            );
          } else {
            const cellObj = celldataMap.get(key);
            sheetEditorRef.current?.setCellValue(
              r,
              c,
              cellObj ?? null,
              { id: sheetId },
              false,
            );
          }
        });
      }

      // Keep currentDataRef aligned (no re-render triggered here)
      if (totalCells > 0 || sheetMetaUpdates.size > 0) {
        try {
          const plain = ySheetArrayToPlain(sheetArray as any);
          currentDataRef.current = plain;
        } catch (e) {
          console.error(
            '[DSheet] ySheetArrayToPlain after surgical remote update failed',
            e,
          );
        }
      }
    };

    sheetArray.observeDeep(observerCallback);

    return () => {
      sheetArray.unobserveDeep(observerCallback);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [ydocRef, dsheetId, setForceSheetRender, sheetEditorRef]);

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
  };
};
