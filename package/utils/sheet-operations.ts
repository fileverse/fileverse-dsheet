import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { isSpreadsheetChanged } from './diff-sheet';
import { fromUint8Array } from 'js-base64';

export const updateSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  data: Sheet[],
  sheetEditor: WorkbookInstance | null,
) => {
  if (!ydoc || !sheetEditor) return;

  const sheetArray = ydoc.getArray(dsheetId);
  const preSheetArray = Array.from(sheetArray) as Sheet[];

  const formattedData = formatSheetData(data, preSheetArray, sheetEditor);

  if (isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], formattedData)) {
    ydoc.transact(() => {
      sheetArray.delete(0, preSheetArray.length);
      sheetArray.insert(0, formattedData);
    });

    // Get and log the Yjs update after the transaction
    const encodedState = Y.encodeStateAsUpdate(ydoc);
    console.log('Yjs Encoded:', fromUint8Array(encodedState));
    console.log('Yjs Decoded:', Y.decodeUpdate(encodedState));
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
      row: preSheetArray[index]?.row,
      column: preSheetArray[index]?.column,
      status: preSheetArray[index]?.status,
      order: preSheetArray[index]?.order,
      config: sheet.config,
    };
    delete newSheet.data;
    return newSheet;
  });
};
