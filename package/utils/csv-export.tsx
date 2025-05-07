import { Sheet } from '@fileverse-dev/fortune-core';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { MutableRefObject } from 'react';

export const handleExportToCSV = (
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

    const activeSheet =
      sheetData.find((sheet) => sheet.status === 1) || sheetData[0];

    if (
      !activeSheet ||
      !activeSheet.celldata ||
      activeSheet.celldata.length === 0
    ) {
      console.error('No data to export');
      return;
    }

    // Find the maximum row and column indices
    let maxRow = 0;
    let maxCol = 0;

    activeSheet.celldata.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.r);
      maxCol = Math.max(maxCol, cell.c);
    });

    const rows: string[][] = [];
    for (let i = 0; i <= maxRow; i++) {
      rows[i] = Array(maxCol + 1).fill('');
    }

    activeSheet.celldata.forEach((cell) => {
      const value =
        cell.v && cell.v.v !== undefined && cell.v.v !== null ? cell.v.v : '';
      rows[cell.r][cell.c] = String(value);
    });

    // Convert rows to CSV format
    const csvContent = rows
      .map((row) => {
        return row
          .map((cell) => {
            // Handle values that need to be quoted (contain commas, quotes, or newlines)
            if (cell === null || cell === undefined) {
              return '';
            }

            const cellStr = String(cell);
            if (
              cellStr.includes(',') ||
              cellStr.includes('"') ||
              cellStr.includes('\n')
            ) {
              // Escape quotes by doubling them and wrap in quotes
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',');
      })
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeSheet.name || 'flvSheet'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('CSV export failed:', error);
  }
};
