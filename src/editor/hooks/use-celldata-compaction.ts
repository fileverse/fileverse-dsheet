import { useEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type * as Y from 'yjs';
import type { WorkbookInstance, Sheet } from '@sheet-engine/react';
import {
  compactInMemorySheets,
  hasCelldataCompactionCompleted,
  markCelldataCompactionCompleted,
  planYdocCelldataCompaction,
} from '../utils/compact-committed-celldata';
import { updateYdocSheetData } from '../utils/update-ydoc';

/** Wait for editor + IDB sync, then a quiet window before scanning. */
const SETTLE_MS = 4_000;
/** Max deletes per Yjs transaction — yield between chunks on huge sheets. */
const DELETE_CHUNK_SIZE = 2_000;

type UseCelldataCompactionArgs = {
  dsheetId: string;
  ydocRef: RefObject<Y.Doc | null>;
  sheetEditorRef: RefObject<WorkbookInstance | null>;
  currentDataRef: MutableRefObject<Sheet[]>;
  handleOnChangePortalUpdate: () => void;
  syncStatus: 'initializing' | 'syncing' | 'synced' | 'error';
  isDataLoaded: boolean;
  isReadOnly: boolean;
  remoteUpdateRef: MutableRefObject<boolean>;
  collabSyncing: boolean;
};

async function applyCompactionChangesInChunks(
  ydoc: Y.Doc,
  dsheetId: string,
  changes: ReturnType<typeof planYdocCelldataCompaction>['changes'],
  handleOnChangePortalUpdate: () => void,
  isCancelled: () => boolean,
): Promise<void> {
  for (let i = 0; i < changes.length; i += DELETE_CHUNK_SIZE) {
    if (isCancelled()) return;
    const chunk = changes.slice(i, i + DELETE_CHUNK_SIZE);
    const isLast = i + DELETE_CHUNK_SIZE >= changes.length;
    updateYdocSheetData(
      ydoc,
      dsheetId,
      chunk,
      isLast ? handleOnChangePortalUpdate : undefined,
    );
    if (!isLast) {
      await new Promise<void>((resolve) => {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(() => resolve(), { timeout: 2_000 });
        } else {
          window.setTimeout(resolve, 0);
        }
      });
    }
  }
}

/**
 * One-shot background compaction: remove committed celldata entries that copy/paste
 * would never write (`shouldPersistCelldataCell` === false). Runs once per dsheetId
 * after the editor is synced and idle so it does not compete with load or edits.
 */
export function useCelldataCompaction({
  dsheetId,
  ydocRef,
  sheetEditorRef,
  currentDataRef,
  handleOnChangePortalUpdate,
  syncStatus,
  isDataLoaded,
  isReadOnly,
  remoteUpdateRef,
  collabSyncing,
}: UseCelldataCompactionArgs): void {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!dsheetId || isReadOnly) return;
    if (syncStatus !== 'synced' || !isDataLoaded) return;
    if (hasCelldataCompactionCompleted(dsheetId)) return;
    if (runningRef.current) return;

    let cancelled = false;
    let settleTimer: number | null = null;
    let idleId: number | null = null;

    const isCancelled = () => cancelled;

    const runCompaction = () => {
      if (cancelled || runningRef.current) return;
      if (remoteUpdateRef.current || collabSyncing) return;

      const ydoc = ydocRef.current;
      if (!ydoc) return;

      runningRef.current = true;

      void (async () => {
        try {
          if (isCancelled() || remoteUpdateRef.current) return;

          const plan = planYdocCelldataCompaction(ydoc, dsheetId);
          const clearedInMemory = compactInMemorySheets(currentDataRef.current);

          if (plan.changes.length > 0) {
            await applyCompactionChangesInChunks(
              ydoc,
              dsheetId,
              plan.changes,
              handleOnChangePortalUpdate,
              isCancelled,
            );
          } else if (clearedInMemory > 0) {
            handleOnChangePortalUpdate();
          }

          if (
            !isCancelled() &&
            (plan.removedFromYdoc > 0 || clearedInMemory > 0)
          ) {
            const ctx = sheetEditorRef.current?.getWorkbookContext?.() as
              | { luckysheetfile?: Sheet[] }
              | undefined;
            if (ctx?.luckysheetfile) {
              compactInMemorySheets(ctx.luckysheetfile);
            }
          }

          markCelldataCompactionCompleted(dsheetId);
        } catch (err) {
          console.warn('[DSheet] Celldata compaction failed:', err);
        } finally {
          runningRef.current = false;
        }
      })();
    };

    const scheduleAfterIdle = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(
          (deadline) => {
            idleId = null;
            if (cancelled) return;
            if (deadline.timeRemaining() > 8 || deadline.didTimeout) {
              runCompaction();
            } else {
              idleId = window.requestIdleCallback(() => {
                idleId = null;
                if (!cancelled) runCompaction();
              });
            }
          },
          { timeout: 8_000 },
        );
      } else {
        runCompaction();
      }
    };

    settleTimer = window.setTimeout(scheduleAfterIdle, SETTLE_MS);

    return () => {
      cancelled = true;
      if (settleTimer != null) window.clearTimeout(settleTimer);
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [
    dsheetId,
    ydocRef,
    sheetEditorRef,
    currentDataRef,
    handleOnChangePortalUpdate,
    syncStatus,
    isDataLoaded,
    isReadOnly,
    remoteUpdateRef,
    collabSyncing,
  ]);
}
