import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { isSpreadsheetChanged } from './diff-sheet';


export const updateSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  data: Sheet[],
  sheetEditor: WorkbookInstance | null,
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } },
  isReadOnly?: boolean
) => {
  const currentSheetId: string = sheetEditor?.getWorkbookContext()
    ?.currentSheetId as string;
  if (dataBlockCalcFunction?.[currentSheetId as string]) {
    data = (data as Sheet[]).map((sheet) => {
      return {
        ...sheet,
        dataBlockCalcFunction: dataBlockCalcFunction[sheet.id as string],
      };
    });
  }
  if (!ydoc || !sheetEditor) {
    return;
  }

  const sheetArray = ydoc.getArray(dsheetId);
  const preSheetArray = Array.from(sheetArray) as Sheet[];

  const formattedData = formatSheetData(data, preSheetArray, sheetEditor);

  // Only update YJS if there's an actual change
  if (isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], formattedData) && !isReadOnly) {
    // Perform the update in a transaction
    ydoc.transact(() => {
      sheetArray.delete(0, preSheetArray.length);
      sheetArray.insert(0, formattedData);
    });
  }
};

export const formatSheetData = (
  data: Sheet[],
  preSheetArray: Sheet[],
  sheetEditor: WorkbookInstance,
): Sheet[] => {
  return data.map((sheet: Sheet, index) => {
    const sheetCellData = sheet['data'];
    if (!sheetCellData) return sheet;

    const transformedData = sheetEditor.dataToCelldata(sheetCellData);
    const newSheet = {
      ...sheet,
      celldata: transformedData,
      row: preSheetArray[index]?.row || sheet.row,
      column: preSheetArray[index]?.column || sheet.column,
      status: preSheetArray[index]?.status || sheet.status,
      order: preSheetArray[index]?.order || sheet.order,
      config: sheet.config,
      dataVerification:
        sheet.dataVerification || preSheetArray[index]?.dataVerification,
      conditionRules:
        // @ts-ignore
        sheet.conditionRules || preSheetArray[index]?.conditionRules,
    };
    delete newSheet.data;
    return newSheet;
  });
};
