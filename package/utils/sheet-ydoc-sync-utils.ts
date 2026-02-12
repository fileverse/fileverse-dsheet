import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { diffObjectMap } from './diff-sheet';
import { SheetChangePath, updateYdocSheetData, ySheetArrayToPlain } from './update-ydoc';

type SyncContext = {
  currentSheetId: string;
  oldSheet: Record<string, any>;
  ydoc: Y.Doc;
};

/**
 * Build a stable sync context from current editor sheet and Yjs snapshot.
 * This keeps all field-level sync handlers aligned on the same baseline.
 */
export const getSheetYdocSyncContext = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
}): SyncContext | null => {
  if (!sheetEditorRef.current || !ydocRef.current) return null;

  const currentSheetId = sheetEditorRef.current.getWorkbookContext()
    ?.currentSheetId as string;
  const oldSheets = ydocRef.current.getArray(dsheetId) as Y.Array<Y.Map<any>>;
  const plainOldSheets = ySheetArrayToPlain(oldSheets);
  const oldSheet =
    (plainOldSheets.find((sheet) => sheet.id === currentSheetId) as Record<
      string,
      any
    >) || {};

  return {
    currentSheetId,
    oldSheet,
    ydoc: ydocRef.current,
  };
};

export const buildMapFieldChanges = ({
  sheetId,
  fieldPath,
  oldData,
  newData,
}: {
  sheetId: string;
  fieldPath: string;
  oldData: Record<string, any>;
  newData: Record<string, any>;
}): SheetChangePath[] => {
  const diff = diffObjectMap(oldData, newData);
  const changes: SheetChangePath[] = [];

  Object.keys(diff.added).forEach((key) => {
    changes.push({
      sheetId,
      path: [fieldPath],
      value: diff.added[key],
      key,
      type: 'update',
    });
  });

  Object.keys(diff.removed).forEach((key) => {
    changes.push({
      sheetId,
      path: [fieldPath],
      value: diff.removed[key],
      key,
      type: 'delete',
    });
  });

  return changes;
};

export const applyYdocSheetChanges = ({
  ydoc,
  dsheetId,
  changes,
  handleContentPortal,
}: {
  ydoc: Y.Doc;
  dsheetId: string;
  changes: SheetChangePath[];
  handleContentPortal?: any;
}) => {
  if (!changes.length) return;
  updateYdocSheetData(ydoc, dsheetId, changes, handleContentPortal);
};
