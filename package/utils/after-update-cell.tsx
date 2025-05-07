import { Cell } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

const formulaResponseUiSync = (
  r: number,
  c: number,
  newV: object,
  apiData: Array<Record<string, object>>,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
) => {
  const headers: string[] = Object.keys(apiData[0]);
  headers.forEach((header, index) => {
    if (index === 0) {
      sheetEditorRef.current?.setCellValue(r, c, { ...newV, m: header });
    } else {
      sheetEditorRef.current?.setCellValue(r, c + index, header);
    }
  });

  let startRow = r + 1;
  for (let i = 0; i < apiData.length; i++) {
    headers.forEach((header, index) => {
      const cellValue = (apiData[i] as Record<string, object>)[header];
      sheetEditorRef.current?.setCellValue(startRow, c + index, {
        ct: { fa: '@', t: 's' },
        m: cellValue,
        v: cellValue,
      });
    });
    startRow++;
  }
};

export const afterUpdateCell = (
  row: number,
  column: number,
  oldValue: Cell,
  newValue: Cell,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
) => {
  if (!newValue || (newValue?.v && !newValue.v)) {
    return;
  }
  if (typeof newValue.v === 'string') {
    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      tb: '1',
    });
  }
  console.log('update cell', oldValue, newValue);
  if (newValue.m === '[object Promise]') {
    // @ts-expect-error // Cell.v type need to include promise as well as type
    newValue.v.then((data: object | string) => {
      if (typeof data === 'string' && data.includes('Error')) {
        sheetEditorRef.current?.setCellValue(row, column, {
          ...newValue,
          m: data,
        });
        return;
      }
      formulaResponseUiSync(
        row,
        column,
        newValue,
        data as Record<string, object>[],
        sheetEditorRef,
      );
    });

    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      m: 'Fetching...',
    });
  }
};
