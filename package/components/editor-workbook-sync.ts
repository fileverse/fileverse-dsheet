import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { SheetChangePath, updateYdocSheetData } from '../utils/update-ydoc';

type SyncContext = {
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>;
  ydocRef: React.MutableRefObject<Y.Doc | null>;
  dsheetId: string;
  handleOnChangePortalUpdate: () => void;
};

const reportSyncWarning = (
  context: string,
  details: Record<string, unknown>,
) => {
  if (typeof window === 'undefined') return;
  const error = new Error(`[WorkbookSync] ${context}`);
  (error as any).details = details;

  if (typeof (window as any).reportError === 'function') {
    (window as any).reportError(error);
  }
};

const logSyncWarning = (
  context: string,
  details: Record<string, unknown>,
) => {
  const isMigrated = typeof window !== 'undefined'
    ? Boolean((window as any).__DSHEET_MIGRATION__?.isMigrated)
    : false;
  const warningDetails = {
    ...details,
    isMigrated,
  };
  // eslint-disable-next-line no-console
  console.warn(`[WorkbookSync] ${context}`, warningDetails);
  reportSyncWarning(context, warningDetails);
};

const getSheetField = (sheet: any, field: string) => {
  if (!sheet) return undefined;
  if (typeof sheet.get === 'function') return sheet.get(field);
  return sheet[field];
};

const setSheetField = (sheet: any, field: string, value: unknown) => {
  if (!sheet) return false;
  if (typeof sheet.set === 'function') {
    sheet.set(field, value);
    return true;
  }
  if (typeof sheet === 'object') {
    sheet[field] = value;
    return true;
  }
  logSyncWarning('setSheetField failed: unsupported sheet type', {
    field,
    value,
    sheet,
    sheetType: typeof sheet,
  });
  return false;
};

const findSheetById = (sheets: any[] | undefined, sheetId: unknown) => {
  if (!Array.isArray(sheets)) return undefined;
  return sheets.find((sheet) => getSheetField(sheet, 'id') === sheetId);
};

const getCurrentYdocSheet = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
}: Omit<SyncContext, 'handleOnChangePortalUpdate'>) => {
  const currentSheet = sheetEditorRef?.current?.getSheet();
  const oldSheets = ydocRef?.current?.getArray(dsheetId);
  return findSheetById(oldSheets?.toArray() as any[] | undefined, currentSheet?.id) as any;
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

  const ydocValue = getSheetField(currentYdocSheet, field);
  if (ydocValue !== currentSheet[field]) {
    setSheetField(currentYdocSheet, field, currentSheet[field]);
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

        sheetEditorRef.current?.activateSheet({ id: sheet.id });
        handleOnChangePortalUpdate();
      }, 50);

      return;
    }

    if (docSheetLength > editorSheetLength && editorSheetLength > 0) {
      const editorSheetIds = new Set(sheets.map((s) => s.id));
      const removedIndex = docSheets.findIndex(
        (ySheet) => !editorSheetIds.has(getSheetField(ySheet, 'id')),
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
    const oldSheetsList = oldSheets?.toArray() as any[] | undefined;
    let changed = false;
    allSheets?.forEach((sheet) => {
      const currentYdocSheet = findSheetById(
        oldSheetsList,
        sheet?.id,
      ) as any;
      if (!currentYdocSheet) {
        logSyncWarning('afterOrderChanges: matching sheet not found', {
          dsheetId,
          targetSheetId: sheet?.id,
          currentSheet: {
            id: getSheetField(sheet, 'id'),
            name: getSheetField(sheet, 'name'),
            hasCelldata: getSheetField(sheet, 'celldata') != null,
          },
          ydocSheets: (oldSheetsList ?? []).map((ydocSheet) => ({
            id: getSheetField(ydocSheet, 'id'),
            name: getSheetField(ydocSheet, 'name'),
            hasCelldata: getSheetField(ydocSheet, 'celldata') != null,
          })),
        });
        return;
      }

      const ydocOrder = getSheetField(currentYdocSheet, 'order');
      if (ydocOrder !== sheet?.order) {
        setSheetField(currentYdocSheet, 'order', sheet?.order);
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
    const oldSheetsList = oldSheets?.toArray() as any[] | undefined;
    let changed = false;

    allSheets?.forEach((sheet) => {
      const currentYdocSheet = findSheetById(
        oldSheetsList,
        sheet?.id,
      ) as any;
      if (!currentYdocSheet) {
        logSyncWarning('afterColorChanges: matching sheet not found', {
          dsheetId,
          targetSheetId: sheet?.id,
          currentSheet: {
            id: getSheetField(sheet, 'id'),
            name: getSheetField(sheet, 'name'),
            hasCelldata: getSheetField(sheet, 'celldata') != null,
          },
          ydocSheets: (oldSheetsList ?? []).map((ydocSheet) => ({
            id: getSheetField(ydocSheet, 'id'),
            name: getSheetField(ydocSheet, 'name'),
            hasCelldata: getSheetField(ydocSheet, 'celldata') != null,
          })),
        });
        return;
      }

      const ydocColor = getSheetField(currentYdocSheet, 'color');
      if (ydocColor !== (sheet as any)?.color) {
        setSheetField(currentYdocSheet, 'color', (sheet as any)?.color);
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
    const oldSheetsList = oldSheets?.toArray() as any[] | undefined;
    let changed = false;

    allSheets?.forEach((sheet) => {
      const currentYdocSheet = findSheetById(
        oldSheetsList,
        sheet?.id,
      ) as any;
      if (!currentYdocSheet) {
        logSyncWarning('afterHideChanges: matching sheet not found', {
          dsheetId,
          targetSheetId: sheet?.id,
          currentSheet: {
            id: getSheetField(sheet, 'id'),
            name: getSheetField(sheet, 'name'),
            hasCelldata: getSheetField(sheet, 'celldata') != null,
          },
          ydocSheets: (oldSheetsList ?? []).map((ydocSheet) => ({
            id: getSheetField(ydocSheet, 'id'),
            name: getSheetField(ydocSheet, 'name'),
            hasCelldata: getSheetField(ydocSheet, 'celldata') != null,
          })),
        });
        return;
      }

      const ydocHide = getSheetField(currentYdocSheet, 'hide');
      if (ydocHide !== (sheet as any)?.hide) {
        setSheetField(currentYdocSheet, 'hide', (sheet as any)?.hide);
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
    const oldSheetsList = oldSheets?.toArray() as any[] | undefined;
    const currentYdocSheet = findSheetById(
      oldSheetsList,
      currentSheet?.id,
    ) as any;
    if (!currentSheet) {
      logSyncWarning('afterColRowChanges: current sheet missing', { dsheetId });
      return;
    }
    if (!currentYdocSheet) {
      logSyncWarning('afterColRowChanges: matching sheet not found', {
        dsheetId,
        targetSheetId: currentSheet?.id,
        currentSheet: {
          id: getSheetField(currentSheet, 'id'),
          name: getSheetField(currentSheet, 'name'),
          hasCelldata: getSheetField(currentSheet, 'celldata') != null,
        },
        ydocSheets: (oldSheetsList ?? []).map((ydocSheet) => ({
          id: getSheetField(ydocSheet, 'id'),
          name: getSheetField(ydocSheet, 'name'),
          hasCelldata: getSheetField(ydocSheet, 'celldata') != null,
        })),
      });
      return;
    }

    const ydocCol = getSheetField(currentYdocSheet, 'column');
    const ydocRow = getSheetField(currentYdocSheet, 'row');
    if (ydocCol !== currentSheet?.column || ydocRow !== currentSheet?.row) {
      setSheetField(currentYdocSheet, 'column', currentSheet?.column);
      setSheetField(currentYdocSheet, 'row', currentSheet?.row);
      handleOnChangePortalUpdate();
    }
  };
};

export const updateAllCell = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleOnChangePortalUpdate,
}: SyncContext, subSheetId: string) => {
  const workbookContext = sheetEditorRef.current?.getWorkbookContext?.() as any;
  const currentSheetId =
    workbookContext?.currentSheetId?.toString?.() ||
    sheetEditorRef.current?.getSheet?.()?.id?.toString?.();
  if (!currentSheetId) return;

  const sheet = sheetEditorRef.current?.getSheet?.();
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
