import Papa from 'papaparse';
import { Sheet } from '@fortune-sheet/core';
import React from 'react';
import * as Y from 'yjs';

export const handleCSVUpload = (
  event: React.ChangeEvent<HTMLInputElement>,
  ydoc: Y.Doc | null,
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
  dsheetId: string,
  currentDataRef: React.MutableRefObject<object | null>,
) => {
  const input = event.target;
  if (!input.files?.length) {
    return;
  }
  const file = input.files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    if (!e.target) {
      console.error('FileReader event target is null');
      return;
    }
    const csvContent = e.target.result;

    if (typeof csvContent === 'string') {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV Parsing errors:', results.errors);
            alert('Error parsing CSV file');
            return;
          }

          // Convert CSV data to fortune-sheet format
          const cellData: {
            r: number;
            c: number;
            v: {
              m: string | number | null;
              ct: { fa: string; t: string };
              v: string | number | null;
            };
          }[] = [];
          const headers = results.meta.fields || [];

          // Add header row
          const headerRow = headers.map((header, index) => ({
            r: 0,
            c: index,
            v: {
              m: header !== null ? header : null,
              ct: {
                fa: 'General',
                t: 'g',
              },
              v: header !== null ? header : null,
            },
          }));

          headerRow.forEach((cell) => {
            cellData.push(cell);
          });

          // Add data rows
          let maxRow = 0;
          let maxCol = 0;
          results.data.forEach((row, rowIndex) => {
            headers.forEach((header, colIndex) => {
              cellData.push({
                r: rowIndex + 1, // +1 because header is row 0
                c: colIndex,
                v: {
                  m:
                    (row as Record<string, string | number | null>)[header] !==
                    null
                      ? (row as Record<string, string | number | null>)[header]
                      : null,
                  ct: {
                    fa: 'General',
                    t: 'g',
                  },
                  v:
                    (row as Record<string, string | number | null>)[header] !==
                    null
                      ? (row as Record<string, string | number | null>)[header]
                      : null,
                }, //(row as Record<string, any>)[header] !== undefined ? (row as Record<string, any>)[header] : ""
              });
              maxRow = Math.max(maxRow, rowIndex + 1);
              maxCol = Math.max(maxCol, colIndex + 1);
            });
          });

          // Create sheet object in fortune-sheet format
          const sheetObject = {
            name: 'Sheet1',
            celldata: [...cellData],
            row: maxRow + 1, // +1 for header
            column: maxCol + 1,
            status: 1,
            order: 0,
            config: {
              merge: {}, // No merge cells for CSV by default
            },
          };

          if (!ydoc) {
            console.error('ydocRef.current is null');
            return;
          }
          const sheetArray = ydoc.getArray(dsheetId);
          ydoc.transact(() => {
            sheetArray.delete(0, sheetArray.length);
            sheetArray.insert(0, [sheetObject]);
            currentDataRef.current = [sheetObject as Sheet];
          });
          setForceSheetRender((prev: number) => prev + 1);
        },
      });
    }
  };

  reader.readAsText(file);
};
