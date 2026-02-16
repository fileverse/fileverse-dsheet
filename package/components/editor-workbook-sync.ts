import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';

type SyncContext = {
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>;
  ydocRef: React.MutableRefObject<Y.Doc | null>;
  dsheetId: string;
  handleOnChangePortalUpdate: () => void;
};

const getCurrentYdocSheet = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
}: Omit<SyncContext, 'handleOnChangePortalUpdate'>) => {
  const currentSheet = sheetEditorRef?.current?.getSheet();
  const oldSheets = ydocRef?.current?.getArray(dsheetId);
  return oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
};

export const syncCurrentSheetField = (
  context: SyncContext,
  field: 'images' | 'iframes' | 'frozen' | 'name' | 'config' | 'showGridLines',
) => {
  const { sheetEditorRef, handleOnChangePortalUpdate } = context;
  const currentSheet = sheetEditorRef?.current?.getSheet() as any;
  const currentYdocSheet = getCurrentYdocSheet(context);
  if (!currentSheet || !currentYdocSheet) return;

  const ydocValue = currentYdocSheet.get(field);
  if (ydocValue !== currentSheet[field]) {
    currentYdocSheet.set(field, currentSheet[field]);
    handleOnChangePortalUpdate();
  }
};

export const createSheetLengthChangeHandler = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  currentDataRef,
  handleOnChangePortalUpdate,
}: {
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>;
  ydocRef: React.MutableRefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<any>;
  handleOnChangePortalUpdate: () => void;
}) => {
  return () => {
    const sheetArray = ydocRef.current?.getArray<Y.Map<any>>(dsheetId);
    const sheets = sheetEditorRef.current?.getAllSheets();

    if (!sheetArray || !sheets) return;

    const docSheets = sheetArray.toArray();
    const docSheetLength = docSheets.length || 1;
    const editorSheetLength = sheets.length || 1;

    if (
      docSheetLength < editorSheetLength &&
      editorSheetLength > 1 &&
      docSheetLength > 0
    ) {
      currentDataRef.current = sheets;

      setTimeout(() => {
        const createdSheet = sheets[sheets.length - 1];
        const sheet = { ...createdSheet };

        const ySheet = new Y.Map<any>();
        ySheet.set('id', sheet.id);
        ySheet.set('name', sheet.name);
        ySheet.set('order', sheet.order);
        ySheet.set('row', sheet.row ?? 500);
        ySheet.set('column', sheet.column ?? 36);
        ySheet.set('status', 1);
        ySheet.set('config', sheet.config ?? {});
        ySheet.set('celldata', new Y.Map());
        ySheet.set('calcChain', new Y.Map());
        ySheet.set('dataBlockCalcFunction', new Y.Array());

        ydocRef.current?.transact(() => {
          sheetArray.push([ySheet]);
        });

        sheetEditorRef.current?.activateSheet({ id: sheet.id });
        handleOnChangePortalUpdate();
      }, 50);

      return;
    }

    if (docSheetLength > editorSheetLength && editorSheetLength > 0) {
      const editorSheetIds = new Set(sheets.map((s) => s.id));
      const removedIndex = docSheets.findIndex(
        (ySheet) => !editorSheetIds.has(ySheet.get('id')),
      );

      if (removedIndex !== -1) {
        currentDataRef.current = sheetEditorRef.current?.getAllSheets() || [];
        setTimeout(() => {
          ydocRef.current?.transact(() => {
            sheetArray.delete(removedIndex, 1);
          });
          handleOnChangePortalUpdate();
        }, 50);
      }
    }
  };
};

export const createAfterOrderChangesHandler = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext) => {
  return () => {
    const allSheets = sheetEditorRef?.current?.getAllSheets();
    const oldSheets = ydocRef?.current?.getArray(dsheetId);
    allSheets?.forEach((sheet) => {
      const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === sheet?.id) as any;
      const ydocOrder = currentYdocSheet?.get('order');
      if (ydocOrder !== sheet?.order) {
        currentYdocSheet?.set('order', sheet?.order);
        handleOnChangePortalUpdate();
      }
    });
  };
};

export const createAfterColRowChangesHandler = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext) => {
  return () => {
    const currentSheet = sheetEditorRef?.current?.getSheet();
    const oldSheets = ydocRef?.current?.getArray(dsheetId);
    const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheet?.id) as any;
    const ydocCol = currentYdocSheet?.get('column');
    const ydocRow = currentYdocSheet?.get('row');
    if (ydocCol !== currentSheet?.column || ydocRow !== currentSheet?.row) {
      currentYdocSheet?.set('column', currentSheet?.column);
      currentYdocSheet?.set('row', currentSheet?.row);
      handleOnChangePortalUpdate();
    }
  };
};
