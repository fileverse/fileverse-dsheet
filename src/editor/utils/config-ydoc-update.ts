import { WorkbookInstance } from '@sheet-engine/react';
import * as Y from 'yjs';
import isEqual from 'lodash/isEqual';
import {
  applyYdocSheetChanges,
  getSheetYdocSyncContext,
} from './sheet-ydoc-sync-utils';
import { SheetChangePath } from './update-ydoc';

/** Diff top-level config sub-keys and emit granular Yjs updates. */
export function buildConfigSubKeyChanges({
  sheetId,
  oldConfig,
  newConfig,
}: {
  sheetId: string;
  oldConfig: Record<string, any>;
  newConfig: Record<string, any>;
}): SheetChangePath[] {
  const changes: SheetChangePath[] = [];
  const old = oldConfig || {};
  const next = newConfig || {};
  const oldKeys = new Set(Object.keys(old));
  const newKeys = new Set(Object.keys(next));

  for (const key of newKeys) {
    const newVal = next[key];
    if (newVal == null) {
      if (oldKeys.has(key) && old[key] != null) {
        changes.push({
          sheetId,
          path: ['config', key],
          value: null,
          type: 'delete',
        });
      }
      continue;
    }
    if (!oldKeys.has(key) || !isEqual(old[key], newVal)) {
      changes.push({
        sheetId,
        path: ['config', key],
        value: newVal,
        type: 'update',
      });
    }
  }

  for (const key of oldKeys) {
    if (!newKeys.has(key) || next[key] == null) {
      changes.push({
        sheetId,
        path: ['config', key],
        value: null,
        type: 'delete',
      });
    }
  }

  return changes;
}

/**
 * Sync active sheet config sub-keys to Yjs (borderInfo, merge, rowlen, …).
 * Replaces whole-config writes so only changed sub-keys are broadcast.
 */
export const configYdocUpdate = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleContentPortal,
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  handleContentPortal?: any;
}) => {
  const syncContext = getSheetYdocSyncContext({
    sheetEditorRef,
    ydocRef,
    dsheetId,
  });
  if (!syncContext) return;

  const newConfig = sheetEditorRef.current?.getSheet()?.config || {};
  const oldConfig = syncContext.oldSheet.config || {};

  const changes = buildConfigSubKeyChanges({
    sheetId: syncContext.currentSheetId,
    oldConfig,
    newConfig,
  });

  applyYdocSheetChanges({
    ydoc: syncContext.ydoc,
    dsheetId,
    changes,
    handleContentPortal,
  });
};
