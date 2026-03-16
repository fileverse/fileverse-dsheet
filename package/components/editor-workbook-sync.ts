import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { SheetChangePath, updateYdocSheetData } from '../utils/update-ydoc';

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
  field:
    | 'images'
    | 'iframes'
    | 'frozen'
    | 'name'
    | 'config'
    | 'showGridLines'
    | 'color'
    | 'hide',
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
      console.log('createdSheet set', sheets);

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

        updateAllCell(
          {
            sheetEditorRef,
            ydocRef,
            dsheetId,
            handleOnChangePortalUpdate,
          },
          sheet.id as string,
        );

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
    let changed = false;
    allSheets?.forEach((sheet) => {
      const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === sheet?.id) as any;
      const ydocOrder = currentYdocSheet?.get('order');
      if (ydocOrder !== sheet?.order) {
        currentYdocSheet?.set('order', sheet?.order);
        changed = true;
      }
    });
    if (changed) handleOnChangePortalUpdate();
  };
};

export const createAfterColorChangesHandler = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext) => {
  return () => {
    const allSheets = sheetEditorRef?.current?.getAllSheets();
    const oldSheets = ydocRef?.current?.getArray(dsheetId);
    let changed = false;

    allSheets?.forEach((sheet) => {
      const currentYdocSheet = oldSheets
        ?.toArray()
        .find((s: any) => s.get('id') === sheet?.id) as any;
      if (!currentYdocSheet) return;

      const ydocColor = currentYdocSheet?.get('color');
      if (ydocColor !== (sheet as any)?.color) {
        currentYdocSheet?.set('color', (sheet as any)?.color);
        changed = true;
      }
    });

    if (changed) handleOnChangePortalUpdate();
  };
};

export const createAfterHideChangesHandler = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext) => {
  return () => {
    const allSheets = sheetEditorRef?.current?.getAllSheets();
    const oldSheets = ydocRef?.current?.getArray(dsheetId);
    let changed = false;

    allSheets?.forEach((sheet) => {
      const currentYdocSheet = oldSheets
        ?.toArray()
        .find((s: any) => s.get('id') === sheet?.id) as any;
      if (!currentYdocSheet) return;

      const ydocHide = currentYdocSheet?.get('hide');
      if (ydocHide !== (sheet as any)?.hide) {
        currentYdocSheet?.set('hide', (sheet as any)?.hide);
        changed = true;
      }
    });

    if (changed) handleOnChangePortalUpdate();
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

// export const createUpdateAllCellHandler = ({
//   sheetEditorRef,
//   ydocRef,
//   dsheetId,
//   handleOnChangePortalUpdate,
// }: SyncContext) => {
//   return () =>
//     updateAllCell({
//       sheetEditorRef,
//       ydocRef,
//       dsheetId,
//       handleOnChangePortalUpdate,
//     });
// };

export const updateAllCell = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext, subSheetId: string) => {
  const workbookContext = sheetEditorRef.current?.getWorkbookContext?.() as any;
  console.log('updateAllCell', workbookContext, subSheetId);
  const currentSheetId =
    workbookContext?.currentSheetId?.toString?.() ||
    sheetEditorRef.current?.getSheet?.()?.id?.toString?.();
  if (!currentSheetId) return;

  const sheet = sheetEditorRef.current?.getSheet?.();
  console.log('Updating all cells for sheet:', sheet?.name);
  if (!sheet) return;

  let dataMatrix = (sheet as any).data as any[][] | undefined;
  if (
    !dataMatrix &&
    Array.isArray((sheet as any).celldata) &&
    sheetEditorRef.current?.celldataToData
  ) {
    dataMatrix =
      sheetEditorRef.current.celldataToData(
        (sheet as any).celldata,
        (sheet as any).row,
        (sheet as any).column,
      ) ?? undefined;
  }
  if (!Array.isArray(dataMatrix)) return;

  const changes: SheetChangePath[] = [];
  for (let r = 0; r < dataMatrix.length; r++) {
    const row = dataMatrix[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      changes.push({
        sheetId: subSheetId,
        path: ['celldata'],
        value: { r, c, v: row[c] },
        key: `${r}_${c}`,
        type: 'update',
      });
    }
  }

  updateYdocSheetData(
    // @ts-ignore Y.Doc present at runtime
    ydocRef.current,
    dsheetId,
    changes,
    handleOnChangePortalUpdate,
  );
};
