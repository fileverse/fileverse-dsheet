import { utils as XLSXUtil, writeFile as XLSXWriteFile } from 'xlsx';
import { Sheet } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { MutableRefObject } from 'react';

export const handleExportToXLSX = (
  workbookRef: MutableRefObject<WorkbookInstance | null>,
  ydocRef: MutableRefObject<Y.Doc | null>,
  dsheetId: string,
) => {
  if (!workbookRef.current || !ydocRef.current) return;

  try {
    const ydoc = ydocRef.current;
    const sheetArray = ydoc.getArray(dsheetId);
    const preSheetArray = Array.from(sheetArray) as Sheet[];
    const sheetData = preSheetArray;

    const sheetwithData = workbookRef.current.getAllSheets();

    const workbook = XLSXUtil.book_new();

    sheetData.forEach((sheet, index) => {
      const rows = sheetwithData[index]?.data || [];

      let maxRow = 0;
      let maxCol = 0;

      (sheet.celldata ?? []).forEach((cell: { r: number; c: number }) => {
        maxRow = Math.max(maxRow, cell.r);
        maxCol = Math.max(maxCol, cell.c);
      });
      const worksheet = XLSXUtil.aoa_to_sheet(rows);

      XLSXUtil.book_append_sheet(workbook, worksheet, sheet.name);
    });

    XLSXWriteFile(workbook, 'flvSheet.xlsx');
  } catch (error) {
    console.error('Export failed:', error);
  }
};
