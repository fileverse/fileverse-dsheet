/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@sheet-engine/react';
import { WorkbookInstance } from '@sheet-engine/react';
import { toUint8Array } from 'js-base64';
import isEqual from 'lodash/isEqual';
import * as Y from 'yjs';
import { CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';
import { useLiveQuery } from './live-query/use-live-query';
import { DataBlockApiKeyHandlerType } from '../types';
import { ySheetArrayToPlain } from '../utils/update-ydoc';
import { migrateSheetArrayIfNeeded } from '../utils/migrate-new-yjs';
import {
  beginRemoteApply,
  endRemoteApplyAfterPaint,
  runUnderRemoteApply,
} from '../utils/remote-apply-guard';

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
  collabEnabled = false,
) => {
  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const currentDataRef = useRef<Sheet[]>([]);
  const remoteUpdateRef = useRef<boolean>(false);
  const remoteApplyDepthRef = useRef<number>(0);
  const remoteApplyGuardRefs = useRef({
    remoteApplyDepthRef,
    remoteUpdateRef,
  }).current;
  const dataInitialized = useRef<boolean>(false);
  const isUpdatingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  /** While true, skip surgical applies — workbook is stale vs incoming Yjs sheet ids. */
  const structuralRemountPendingRef = useRef<boolean>(false);
  /** True once portalContent has been applied; reset when `dsheetId` changes. */
  const portalContentAppliedRef = useRef<boolean>(false);

  useEffect(() => {
    portalContentAppliedRef.current = false;
  }, [dsheetId]);

  const { handleLiveQuery, initialiseLiveQueryData } = useLiveQuery(
    sheetEditorRef,
    dataBlockApiKeyHandler,
    enableLiveQuery,
    liveQueryRefreshRate,
  );

  const syncDataBlockCalcFromPlain = useCallback(
    (plain: Sheet[]) => {
      if (!setDataBlockCalcFunction) return;
      const dataBlockList: { [key: string]: any } = {};
      plain.forEach((sheet: Sheet) => {
        if (sheet?.id && sheet?.dataBlockCalcFunction) {
          dataBlockList[sheet.id] = { ...sheet.dataBlockCalcFunction };
        }
      });
      setDataBlockCalcFunction(dataBlockList);
    },
    [setDataBlockCalcFunction],
  );

  // Apply portal content once on first load. Skipped entirely when RTC collaboration
  // is active — SyncManager.syncLatestCommit is the sole source of truth in that case,
  // matching the behaviour of initialContent in fileverse-ddoc.
  useEffect(() => {
    if (collabEnabled) return;
    if (!portalContent?.length || !ydocRef.current) return;
    if (portalContentAppliedRef.current) return;

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

      portalContentAppliedRef.current = true;

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
  }, [portalContent, collabEnabled]);

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
              // Comment keys are built as `${sheet.order}_${row}_${col}` in the
              // host app. `file.order` is the correct primary identifier.
              // `file.id` (UUID) and `fileIndex` (array position) are kept as
              // fallbacks for legacy keys.
              const sheetOrder =
                typeof file?.order === 'number' ? file.order : fileIndex;

              const getComment = (rowIndex: number, colIndex: number) =>
                // Primary: UUID-based key (new, immutable)
                (commentData as any)?.[`${sheetKey}_${rowIndex}_${colIndex}`] ??
                // Legacy: order-based key (old, breaks on reorder)
                (commentData as any)?.[
                `${sheetOrder}_${rowIndex}_${colIndex}`
                ] ??
                // Very-old: array-index fallback
                (commentData as any)?.[`${fileIndex}_${rowIndex}_${colIndex}`];

              // Active sheet: dense data grid
              file.data?.forEach((row: any, rowIndex: number) => {
                row?.forEach((cell: any, colIndex: number) => {
                  if (cell) {
                    const comment = getComment(rowIndex, colIndex);
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

              // Inactive sheets: sparse celldata. initSheetData() converts
              // celldata → data on activation, so ps set here carries through.
              if (!file.data && file.celldata) {
                (file.celldata as any[]).forEach((cellEntry: any) => {
                  if (!cellEntry?.v) return;
                  const comment = getComment(cellEntry.r, cellEntry.c);
                  cellEntry.v.ps =
                    comment && allowComments
                      ? CELL_COMMENT_DEFAULT_VALUE
                      : undefined;
                });
              }
            });
          });
        }
        //handle if data is synced but editor is not rendered/loaded. Usally happens on when allowComments is false on viewerside
        if (sheetEditorRef.current === null && syncStatus === 'synced') {
          const updatedSheets = currentData.map((sheet, index) => {
            const sheetKey = (sheet as any)?.id?.toString?.() ?? String(index);
            const sheetOrder =
              typeof (sheet as any)?.order === 'number'
                ? (sheet as any).order
                : index;
            const updatedCelldata = (sheet.celldata || []).map((cell: any) => {
              const comment =
                // Primary: UUID-based key (new, immutable)
                (commentData as any)?.[`${sheetKey}_${cell.r}_${cell.c}`] ??
                // Legacy: order-based key
                (commentData as any)?.[`${sheetOrder}_${cell.r}_${cell.c}`] ??
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
    if (!hasCollabContentInitialised || !ydocRef.current || !dsheetId) {
      return;
    }
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

        // RTC session: collabInit hydrates currentDataRef after sync — don't claim init here.
        if (collabEnabled) {
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
  }, [dsheetId, isReadOnly, syncStatus, collabEnabled]);

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

    /**
     * Overlay sheet fields (DOM overlays, not canvas) that can be applied
     * imperatively without a remount via setSheetImages / setSheetIframes.
     * A remote move/resize of an image or iframe only touches these.
     */
    const SURGICAL_OVERLAY_KEYS = new Set(['images', 'iframes']);

    /**
     * Map-backed sheet fields applied imperatively via WorkbookInstance helpers.
     */
    const SURGICAL_MAP_FIELD_KEYS = new Set([
      'dataVerification',
      'filter_select',
      'hyperlink',
      'conditionRules',
    ]);

    /** Whole-object sheet fields with imperative remote apply. */
    const SURGICAL_OBJECT_FIELD_KEYS = new Set(['filter']);

    /**
     * Object sheet fields that drive layout and require a remount when they
     * genuinely change, but are rebuilt as fresh references on every remount.
     * A remote change to one of these is only "real" if its value differs from
     * the live workbook value — otherwise it is a redundant echo (see the
     * cross-peer config remount ping-pong) and must NOT trigger another remount.
     */
    const LAYOUT_OBJECT_KEYS = new Set(['config', 'frozen']);

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

      // --- Classify events: cell-only vs structural ---
      type CellBatch = {
        sheetId: string;
        celldataMap: Y.Map<any>;
        changedKeys: Map<string, { action: string }>;
      };
      type DataVerificationBatch = {
        sheetId: string;
        dvMap: Y.Map<any>;
      };
      type FilterBatch = {
        sheetId: string;
        sheetMap: Y.Map<any>;
      };
      type MapFieldBatch = {
        sheetId: string;
        field: string;
        map: Y.Map<any>;
      };
      type ConditionFormatBatch = {
        sheetId: string;
        rules: any[];
      };
      const cellBatches: CellBatch[] = [];
      const dataVerificationUpdates = new Map<string, DataVerificationBatch>();
      const filterUpdates = new Map<string, FilterBatch>();
      const mapFieldUpdates = new Map<string, MapFieldBatch>();
      const conditionFormatUpdates = new Map<string, ConditionFormatBatch>();
      const sheetMetaUpdates = new Map<
        string,
        { sheetId: string; sheetMap: Y.Map<any>; changedKeys: string[] }
      >();
      const overlayUpdates = new Map<
        string,
        { sheetId: string; sheetMap: Y.Map<any>; changedKeys: Set<string> }
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
          path[1] === 'dataVerification' &&
          typeof path[0] === 'number'
        ) {
          const sheetMap = sheetsArr[path[0] as number];
          if (!(sheetMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          const sheetId = sheetMap.get('id') as string;
          const dvMap = sheetMap.get('dataVerification');
          if (!sheetId || !(dvMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          dataVerificationUpdates.set(sheetId, { sheetId, dvMap });
        } else if (
          path.length === 2 &&
          path[1] === 'filter_select' &&
          typeof path[0] === 'number'
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
          filterUpdates.set(sheetId, { sheetId, sheetMap });
        } else if (
          path.length === 2 &&
          path[1] === 'filter' &&
          typeof path[0] === 'number'
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
          filterUpdates.set(sheetId, { sheetId, sheetMap });
        } else if (
          path.length === 2 &&
          (path[1] === 'hyperlink' || path[1] === 'conditionRules') &&
          typeof path[0] === 'number'
        ) {
          const sheetMap = sheetsArr[path[0] as number];
          if (!(sheetMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          const sheetId = sheetMap.get('id') as string;
          const field = path[1] as string;
          const fieldMap = sheetMap.get(field);
          if (!sheetId || !(fieldMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          mapFieldUpdates.set(`${sheetId}:${field}`, {
            sheetId,
            field,
            map: fieldMap,
          });
        } else if (
          path.length === 2 &&
          path[1] === 'luckysheet_conditionformat_save' &&
          typeof path[0] === 'number'
        ) {
          const sheetMap = sheetsArr[path[0] as number];
          if (!(sheetMap instanceof Y.Map)) {
            hasStructural = true;
            continue;
          }
          const sheetId = sheetMap.get('id') as string;
          const rulesArr = sheetMap.get('luckysheet_conditionformat_save');
          if (!sheetId || !(rulesArr instanceof Y.Array)) {
            hasStructural = true;
            continue;
          }
          conditionFormatUpdates.set(sheetId, {
            sheetId,
            rules: rulesArr.toJSON(),
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
              changedKeys.every(
                (k) =>
                  SURGICAL_SHEET_META_KEYS.has(k) ||
                  SURGICAL_OVERLAY_KEYS.has(k) ||
                  SURGICAL_MAP_FIELD_KEYS.has(k) ||
                  SURGICAL_OBJECT_FIELD_KEYS.has(k) ||
                  k === 'luckysheet_conditionformat_save',
              )
            ) {
              // color/hide have no imperative WorkbookInstance API — must remount.
              if (changedKeys.some((k) => k === 'color' || k === 'hide')) {
                hasStructural = true;
                continue;
              }
              const sheetId = sheetMap.get('id') as string;
              if (sheetId) {
                const metaKeys = changedKeys.filter((k) =>
                  SURGICAL_SHEET_META_KEYS.has(k),
                );
                const overlayKeys = changedKeys.filter((k) =>
                  SURGICAL_OVERLAY_KEYS.has(k),
                );
                const mapFieldKeys = changedKeys.filter(
                  (k) =>
                    SURGICAL_MAP_FIELD_KEYS.has(k) ||
                    SURGICAL_OBJECT_FIELD_KEYS.has(k),
                );
                if (metaKeys.length > 0) {
                  const existing = sheetMetaUpdates.get(sheetId);
                  sheetMetaUpdates.set(sheetId, {
                    sheetId,
                    sheetMap,
                    changedKeys: existing
                      ? [...existing.changedKeys, ...metaKeys]
                      : metaKeys,
                  });
                }
                if (overlayKeys.length > 0) {
                  const existing = overlayUpdates.get(sheetId);
                  const keys = existing?.changedKeys ?? new Set<string>();
                  overlayKeys.forEach((k) => keys.add(k));
                  overlayUpdates.set(sheetId, {
                    sheetId,
                    sheetMap,
                    changedKeys: keys,
                  });
                }
                if (mapFieldKeys.includes('dataVerification')) {
                  const dvMap = sheetMap.get('dataVerification');
                  if (dvMap instanceof Y.Map) {
                    dataVerificationUpdates.set(sheetId, { sheetId, dvMap });
                  }
                }
                if (
                  mapFieldKeys.some((k) =>
                    SURGICAL_OBJECT_FIELD_KEYS.has(k),
                  ) ||
                  mapFieldKeys.includes('filter_select')
                ) {
                  filterUpdates.set(sheetId, { sheetId, sheetMap });
                }
                mapFieldKeys
                  .filter((k) => k === 'hyperlink' || k === 'conditionRules')
                  .forEach((field) => {
                    const fieldMap = sheetMap.get(field);
                    if (fieldMap instanceof Y.Map) {
                      mapFieldUpdates.set(`${sheetId}:${field}`, {
                        sheetId,
                        field,
                        map: fieldMap,
                      });
                    }
                  });
                if (changedKeys.includes('luckysheet_conditionformat_save')) {
                  const rulesArr = sheetMap.get(
                    'luckysheet_conditionformat_save',
                  );
                  if (rulesArr instanceof Y.Array) {
                    conditionFormatUpdates.set(sheetId, {
                      sheetId,
                      rules: rulesArr.toJSON(),
                    });
                  }
                }
                continue;
              }
            }

            // Fix B: a config/frozen-only remote change should remount ONLY if
            // the value actually differs from the live workbook value. A
            // redundant echo (identical value, fresh reference) is skipped so
            // it cannot drive a remount loop.
            if (
              changedKeys.length > 0 &&
              changedKeys.every((k) => LAYOUT_OBJECT_KEYS.has(k))
            ) {
              const sheetId = sheetMap.get('id') as string;
              const wbSheet = sheetEditorRef.current
                ?.getWorkbookContext?.()
                ?.luckysheetfile?.find((s) => s.id === sheetId) as
                | Record<string, any>
                | undefined;
              if (wbSheet) {
                const allEqual = changedKeys.every((k) =>
                  isEqual(sheetMap.get(k), wbSheet[k]),
                );
                if (allEqual) {
                  // Redundant echo — ignore entirely (no remount).
                  continue;
                }
              }
              // Genuine layout change — fall through to a remount.
              hasStructural = true;
              continue;
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
        if (
          cellBatches.length > 0 ||
          sheetMetaUpdates.size > 0 ||
          overlayUpdates.size > 0 ||
          dataVerificationUpdates.size > 0 ||
          filterUpdates.size > 0 ||
          mapFieldUpdates.size > 0 ||
          conditionFormatUpdates.size > 0
        )
          continue;
        const changedKeys = Array.from((event as Y.YMapEvent<any>).keys.keys());
        if (changedKeys.length === 0) continue;
        hasStructural = true;
      }

      const totalCells = cellBatches.reduce(
        (n, b) => n + b.changedKeys.size,
        0,
      );

      const workbookSheetIds = new Set(
        sheetEditorRef.current
          ?.getWorkbookContext?.()
          ?.luckysheetfile?.map((s) => s.id)
          .filter(Boolean) ?? [],
      );
      const remoteSheetIds = [
        ...cellBatches.map((b) => b.sheetId),
        ...sheetMetaUpdates.keys(),
        ...overlayUpdates.keys(),
        ...dataVerificationUpdates.keys(),
        ...filterUpdates.keys(),
        ...Array.from(mapFieldUpdates.values()).map((b) => b.sheetId),
        ...conditionFormatUpdates.keys(),
      ];
      const hasUnknownSheet = remoteSheetIds.some(
        (id) => id && !workbookSheetIds.has(id),
      );

      const scheduleStructuralRemount = () => {
        structuralRemountPendingRef.current = true;
        beginRemoteApply(remoteApplyGuardRefs);
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          const isEditingCell =
            (sheetEditorRef.current?.getWorkbookContext?.()
              ?.luckysheetCellUpdate?.length ?? 0) > 0;
          try {
            const plain = ySheetArrayToPlain(sheetArray as any);
            currentDataRef.current = plain;
            syncDataBlockCalcFromPlain(plain);
          } catch (e) {
            console.error(
              '[DSheet] ySheetArrayToPlain after ydoc observe failed',
              e,
            );
          }
          if (!isEditingCell && setForceSheetRender) {
            setForceSheetRender((prev) => prev + 1);
          }
          structuralRemountPendingRef.current = false;
          debounceTimerRef.current = null;
          endRemoteApplyAfterPaint(remoteApplyGuardRefs);
        }, 50);
      };

      const needsStructuralRemount =
        hasStructural ||
        hasUnknownSheet ||
        structuralRemountPendingRef.current ||
        totalCells > SURGICAL_CELL_LIMIT ||
        !sheetEditorRef.current;

      const applyRemoteSheetMeta = () => {
        const orderList: Record<string, number> = {};
        let hasOrderChange = false;

        for (const {
          sheetId,
          sheetMap,
          changedKeys,
        } of sheetMetaUpdates.values()) {
          try {
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
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote sheet meta apply — workbook not ready',
              { sheetId, error },
            );
          }
        }

        if (hasOrderChange) {
          try {
            sheetEditorRef.current?.setSheetOrder?.(orderList);
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote sheet order apply — workbook not ready',
              error,
            );
          }
        }
      };

      // Apply remote image/iframe overlay changes imperatively (no remount).
      const applyRemoteOverlays = () => {
        for (const {
          sheetId,
          sheetMap,
          changedKeys,
        } of overlayUpdates.values()) {
          try {
            if (changedKeys.has('images')) {
              const images = sheetMap.get('images');
              sheetEditorRef.current?.setSheetImages?.(
                Array.isArray(images) ? images : [],
                { id: sheetId },
              );
            }
            if (changedKeys.has('iframes')) {
              const iframes = sheetMap.get('iframes');
              sheetEditorRef.current?.setSheetIframes?.(
                Array.isArray(iframes) ? iframes : [],
                { id: sheetId },
              );
            }
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote overlay apply — workbook not ready',
              { sheetId, error },
            );
          }
        }
      };

      const applyRemoteDataVerification = () => {
        for (const { sheetId, dvMap } of dataVerificationUpdates.values()) {
          try {
            sheetEditorRef.current?.setSheetDataVerification?.(
              dvMap.toJSON(),
              { id: sheetId },
            );
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote dataVerification apply — workbook not ready',
              { sheetId, error },
            );
          }
        }
      };

      const readFilterFromSheetMap = (sheetMap: Y.Map<any>) => {
        const filterVal = sheetMap.get('filter');
        if (filterVal instanceof Y.Map) {
          const json = filterVal.toJSON();
          return Object.keys(json).length > 0 ? json : undefined;
        }
        if (
          filterVal &&
          typeof filterVal === 'object' &&
          Object.keys(filterVal).length > 0
        ) {
          return filterVal as Record<string, any>;
        }
        return undefined;
      };

      const readFilterSelectFromSheetMap = (sheetMap: Y.Map<any>) => {
        const filterSelectVal = sheetMap.get('filter_select');
        if (filterSelectVal instanceof Y.Map) {
          return filterSelectVal.toJSON() as {
            row: number[];
            column: number[];
          };
        }
        return filterSelectVal as
          | { row: number[]; column: number[] }
          | undefined;
      };

      const applyRemoteFilters = () => {
        for (const { sheetId, sheetMap } of filterUpdates.values()) {
          try {
            sheetEditorRef.current?.setSheetFilterState?.(
              {
                filter: readFilterFromSheetMap(sheetMap),
                filter_select: readFilterSelectFromSheetMap(sheetMap),
              },
              { id: sheetId },
            );
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote filter apply — workbook not ready',
              { sheetId, error },
            );
          }
        }
      };

      const applyRemoteMapFields = () => {
        for (const { sheetId, field, map } of mapFieldUpdates.values()) {
          try {
            const json = map.toJSON();
            sheetEditorRef.current?.setSheetMapField?.(
              field,
              Object.keys(json).length > 0 ? json : undefined,
              { id: sheetId },
            );
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote map field apply — workbook not ready',
              { sheetId, field, error },
            );
          }
        }
      };

      const applyRemoteConditionFormat = () => {
        for (const { sheetId, rules } of conditionFormatUpdates.values()) {
          try {
            sheetEditorRef.current?.setSheetConditionFormatRules?.(rules, {
              id: sheetId,
            });
          } catch (error) {
            console.warn(
              '[DSheet] Skipped remote condition format apply — workbook not ready',
              { sheetId, error },
            );
          }
        }
      };

      const syncPlainSnapshot = () => {
        try {
          const plain = ySheetArrayToPlain(sheetArray as any);
          currentDataRef.current = plain;
        } catch (e) {
          console.error('[DSheet] ySheetArrayToPlain after remote update failed', e);
        }
      };

      // --- Fall back to remount for structural changes or large cell batches ---
      if (needsStructuralRemount) {
        scheduleStructuralRemount();
        return;
      }

      runUnderRemoteApply(remoteApplyGuardRefs, () => {
        if (sheetMetaUpdates.size > 0) {
          applyRemoteSheetMeta();
        }
        if (overlayUpdates.size > 0) {
          applyRemoteOverlays();
        }
        if (dataVerificationUpdates.size > 0) {
          applyRemoteDataVerification();
        }
        if (filterUpdates.size > 0) {
          applyRemoteFilters();
        }
        if (mapFieldUpdates.size > 0) {
          applyRemoteMapFields();
        }
        if (conditionFormatUpdates.size > 0) {
          applyRemoteConditionFormat();
        }

        if (
          totalCells === 0 &&
          (sheetMetaUpdates.size > 0 ||
            overlayUpdates.size > 0 ||
            dataVerificationUpdates.size > 0 ||
            filterUpdates.size > 0 ||
            mapFieldUpdates.size > 0 ||
            conditionFormatUpdates.size > 0)
        ) {
          syncPlainSnapshot();
          return;
        }

        // Surgical path: imperative per-cell updates, zero Workbook remount
        for (const { sheetId, celldataMap, changedKeys } of cellBatches) {
          changedKeys.forEach(({ action }, key) => {
            const sep = key.lastIndexOf('_');
            const r = parseInt(key.slice(0, sep), 10);
            const c = parseInt(key.slice(sep + 1), 10);

            try {
              if (action === 'delete') {
                sheetEditorRef.current?.applyRemoteCellValue(r, c, null, {
                  id: sheetId,
                });
              } else {
                const cellObj = celldataMap.get(key);
                const remoteCell = cellObj?.v ?? null;
                sheetEditorRef.current?.applyRemoteCellValue(r, c, remoteCell, {
                  id: sheetId,
                });
              }
            } catch (error) {
              console.warn(
                '[DSheet] Skipped remote cell apply — workbook not ready',
                { sheetId, r, c, error },
              );
            }
          });
        }

        if (
          totalCells > 0 ||
          sheetMetaUpdates.size > 0 ||
          overlayUpdates.size > 0 ||
          dataVerificationUpdates.size > 0 ||
          filterUpdates.size > 0 ||
          mapFieldUpdates.size > 0 ||
          conditionFormatUpdates.size > 0
        ) {
          syncPlainSnapshot();
        }
      });
    };

    sheetArray.observeDeep(observerCallback);

    return () => {
      sheetArray.unobserveDeep(observerCallback);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    ydocRef,
    dsheetId,
    setForceSheetRender,
    sheetEditorRef,
    syncDataBlockCalcFromPlain,
  ]);

  // Rebuild the full plain snapshot from the current Yjs doc and force a Workbook
  // remount. Used after a collab (RTC) sync completes, where surgical applies are
  // unsafe because the local workbook may be stale relative to the merged server
  // state. Returns true when a rebuild was performed.
  const rehydrateWorkbookFromYdoc = useCallback(
    (reason = 'host'): boolean => {
      if (!ydocRef.current || !dsheetId) return false;

      try {
        const sheetArray = ydocRef.current.getArray(dsheetId);
        migrateSheetArrayIfNeeded(ydocRef.current, sheetArray);

        // @ts-ignore
        const plain = ySheetArrayToPlain(sheetArray as Y.Array<Y.Map>);

        beginRemoteApply(remoteApplyGuardRefs);

        currentDataRef.current = plain;
        syncDataBlockCalcFromPlain(plain);
        initialiseLiveQueryData(plain);

        dataInitialized.current = true;
        setIsDataLoaded(true);

        if (setForceSheetRender) {
          setForceSheetRender((prev) => prev + 1);
        }

        endRemoteApplyAfterPaint(remoteApplyGuardRefs);

        return true;
      } catch (error) {
        console.error(
          `[DSheet] rehydrateWorkbookFromYdoc failed (reason: ${reason})`,
          error,
        );
        return false;
      }
    },
    [
      ydocRef,
      dsheetId,
      syncDataBlockCalcFromPlain,
      initialiseLiveQueryData,
      setForceSheetRender,
    ],
  );

  // Handle changes to the sheet
  const handleChange = useCallback(
    (_data: Sheet[]) => {
      if (remoteUpdateRef.current) {
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
    rehydrateWorkbookFromYdoc,
  };
};
