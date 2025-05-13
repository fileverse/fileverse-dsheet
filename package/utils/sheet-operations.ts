import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { isSpreadsheetChanged } from './diff-sheet';

export const updateSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  data: Sheet[],
  sheetEditor: WorkbookInstance | null,
) => {
  if (!ydoc || !sheetEditor) {
    return;
  }

  const sheetArray = ydoc.getArray(dsheetId);
  const preSheetArray = Array.from(sheetArray) as Sheet[];

  const formattedData = formatSheetData(data, preSheetArray, sheetEditor);

  if (isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], formattedData)) {
    ydoc.transact(() => {
      sheetArray.delete(0, preSheetArray.length);
      sheetArray.insert(0, formattedData);
    });

    // Update encoding state
    Y.encodeStateAsUpdate(ydoc);
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
    };
    delete newSheet.data;
    return newSheet;
  });
};
