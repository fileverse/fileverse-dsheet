import * as Y from 'yjs';
import { WorkbookInstance } from '@sheet-engine/react';
import { MutableRefObject } from 'react';
import { Cell } from '../../sheet-engine/core/types';

const getCellValue = (v: Cell | null | undefined): string => {
  if (!v) return '';
  const isDate = v.ct?.t === 'd';
  if (isDate && v.m != null) return String(v.m);
  if (v.v !== undefined && v.v !== null) return String(v.v);
  return '';
};

export const handleExportToCSV = async (
  workbookRef: MutableRefObject<WorkbookInstance | null>,
  ydocRef: MutableRefObject<Y.Doc | null>,
  _dsheetId?: string,
  getDocumentTitle?: (dsheetId: string) => Promise<string>,
) => {
  if (!workbookRef.current || !ydocRef.current) return;

  try {
    const activeSheet = workbookRef.current.getSheet();

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
      rows[cell.r][cell.c] = getCellValue(cell.v);
    });

    // Trim trailing empty rows
    while (
      rows.length > 0 &&
      rows[rows.length - 1].every((cell) => cell === '')
    ) {
      rows.pop();
    }
    if (rows.length === 0) {
      console.error('No data to export');
      return;
    }

    // Trim trailing empty columns
    let maxContentCol = 0;
    rows.forEach((row) => {
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== '') {
          maxContentCol = Math.max(maxContentCol, c);
          break;
        }
      }
    });
    const trimmedRows = rows.map((row) => row.slice(0, maxContentCol + 1));

    // Convert rows to CSV format
    const csvContent = trimmedRows
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
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const title = (await getDocumentTitle?.(_dsheetId as string)) || 'Untitled';

    link.setAttribute('download', `${title + ' - ' + activeSheet.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('CSV export failed:', error);
  }
};
