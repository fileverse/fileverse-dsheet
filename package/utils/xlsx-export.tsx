import { utils as XLSXUtil, writeFile as XLSXWriteFile } from 'xlsx';
import { Sheet } from '@fileverse-dev/fortune-core';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { MutableRefObject } from 'react';

export const handleExportToXLSX = (
  workbookRef: MutableRefObject<WorkbookInstance | null>,
  ydocRef: MutableRefObject<Y.Doc | null>,
  dsheetId: string,
  getDocumentTitle?: () => string,
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

      // Create worksheet from array data first
      const worksheet = XLSXUtil.aoa_to_sheet(rows);

      // Apply formulas and formatting from original celldata
      (sheet.celldata ?? []).forEach((cell: any) => {
        const cellRef = XLSXUtil.encode_cell({ r: cell.r, c: cell.c });

        if (cell.v) {
          // Create a new cell object to avoid read-only property issues
          const existingCell = worksheet[cellRef] || {};
          const newCell: any = { ...existingCell };

          // Apply formula if it exists
          if (cell.v.f) {
            newCell.f = cell.v.f.split('=')[1].trim();  // Preserve formula like "=SUM(6,6)"
          }

          // Apply calculated value
          if (cell.v.v !== undefined) {
            newCell.v = cell.v.v;
          }

          // Apply display value if exists
          if (cell.v.m) {
            newCell.w = cell.v.m;
          }

          // Apply cell type and formatting (simplified to avoid Google Sheets conflicts)
          if (cell.v.ct) {
            // Use simpler number formats to avoid Google Sheets issues
            if (cell.v.ct.fa === '#,##0.00') {
              newCell.z = '0.00';  // Simplified number format
            } else if (cell.v.ct.fa === 'General') {
              newCell.z = 'General';
            }

            // Set cell type
            if (cell.v.ct.t) {
              newCell.t = cell.v.ct.t;
            }
          }

          // Assign the new cell object back to the worksheet
          worksheet[cellRef] = newCell;
        }
      });
      console.log(worksheet, "worksheet");
      XLSXUtil.book_append_sheet(workbook, worksheet, sheet.name);
    });

    // Modify workbook properties to be more compatible with Google Sheets
    workbook.Props = {
      ...workbook.Props,
      Application: "Microsoft Excel",  // Changed from "SheetJS"
      Company: "",
      Manager: ""
    };

    console.log(workbook, "workbook");


    // Write with enhanced options for better Google Sheets compatibility
    const title = getDocumentTitle?.();
    XLSXWriteFile(workbook, `${title}.xlsx`, {
      bookType: 'xlsx',
      type: 'binary',
      sheetStubs: false,    // Don't create stub cells
      bookSST: false,       // Don't use shared string table (can cause issues)
      compression: true     // Enable compression for better compatibility
    });

  } catch (error) {
    console.error('Export failed:', error);
  }
};
