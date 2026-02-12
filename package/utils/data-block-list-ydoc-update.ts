import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import {
  applyYdocSheetChanges,
  buildMapFieldChanges,
  getSheetYdocSyncContext,
} from './sheet-ydoc-sync-utils';

/**
 * Sync dataBlockCalcFunction map for the active sheet to Yjs.
 */
export const dataBlockListYdocUpdate = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleContentPortal,
  dataBlockCalcFunction
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  handleContentPortal?: any,
  dataBlockCalcFunction?: any
}
) => {
  const syncContext = getSheetYdocSyncContext({
    sheetEditorRef,
    ydocRef,
    dsheetId,
  });
  if (!syncContext) return;

  const newData = dataBlockCalcFunction?.[syncContext.currentSheetId] || {};
  const oldData = syncContext.oldSheet.dataBlockCalcFunction || {};

  const changes = buildMapFieldChanges({
    sheetId: syncContext.currentSheetId,
    fieldPath: 'dataBlockCalcFunction',
    oldData,
    newData,
  });

  applyYdocSheetChanges({
    ydoc: syncContext.ydoc,
    dsheetId,
    changes,
    handleContentPortal,
  });
};