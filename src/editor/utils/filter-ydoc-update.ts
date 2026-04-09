import { WorkbookInstance } from '@sheet-engine/react';
import * as Y from 'yjs';
import {
  applyYdocSheetChanges,
  getSheetYdocSyncContext,
} from './sheet-ydoc-sync-utils';
import { SheetChangePath } from './update-ydoc';

/**
 * Sync `filter` for active sheet.
 * Stored as one object payload in Yjs (keys like "0", "1", "all" map to objects).
 */
export const filterYdocUpdate = ({
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

  const newData = (sheetEditorRef.current?.getSheet() as any)?.filter || {};
  const oldData = syncContext.oldSheet.filter || {};

  const changed = (() => {
    try {
      return JSON.stringify(oldData || {}) !== JSON.stringify(newData || {});
    } catch {
      return true;
    }
  })();
  if (!changed) return;

  const changes: SheetChangePath[] = [
    {
      sheetId: syncContext.currentSheetId,
      path: ['filter'],
      value: newData || {},
      key: 'filter',
      type: 'update',
    },
  ];

  applyYdocSheetChanges({
    ydoc: syncContext.ydoc,
    dsheetId,
    changes,
    handleContentPortal,
  });
};
