import Papa from 'papaparse';
import { Sheet } from '@fileverse-dev/fortune-core';
import React from 'react';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

export const handleCSVUpload = (
  event: React.ChangeEvent<HTMLInputElement>,
  ydoc: Y.Doc | null,
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
  dsheetId: string,
  currentDataRef: React.MutableRefObject<object | null>,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
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
          const headerRow = headers.map((headerV, index) => {
            // @ts-expect-error later
            const renamedHeadersKeys = results.meta.renamedHeaders ? Object.keys(results.meta.renamedHeaders) : [];
            // @ts-expect-error later
            const header = renamedHeadersKeys.includes(headerV) ? results.meta.renamedHeaders[headerV] : headerV;
            return {
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
            }
          });

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
                  // @ts-expect-error later
                  m:
                    (row as Record<string, string | null>)[header] !== null
                      ? (row as Record<string, string | null>)[
                        header
                      ]?.toString()
                      : null,
                  ct: {
                    fa: 'General',
                    t: 'g',
                  },
                  // @ts-expect-error later
                  v:
                    (row as Record<string, string | number | null>)[header] !==
                      null
                      ? (row as Record<string, string | number | null>)[
                        header
                      ]?.toString()
                      : null,
                },
              });
              maxRow = Math.max(maxRow, rowIndex + 1);
              maxCol = Math.max(maxCol, colIndex + 1);
            });
          });

          // Create sheet object in fortune-sheet format
          const rowCount = maxRow + 1 < 500 ? 500 : maxRow + 1;
          const colCount = maxCol + 1 < 36 ? 36 : maxCol + 1;

          if (!ydoc) {
            console.error('ydocRef.current is null');
            return;
          }

          const sheetArray = ydoc.getArray(dsheetId);
          const data = Array.from(sheetArray) as Sheet[];

          const sheetObject = {
            name: file.name || 'Sheet1',
            celldata: [...cellData],
            row: rowCount,
            column: colCount,
            status: 1,
            order: data.length,
            config: {
              merge: {}, // No merge cells for CSV by default
            },
          };

          const finalData = [...data, sheetObject as Sheet];
          ydoc.transact(() => {
            sheetArray.delete(0, sheetArray.length);
            sheetArray.insert(0, finalData);

            currentDataRef.current = finalData;
          });
          setForceSheetRender((prev: number) => prev + 1);
          setTimeout(() => {
            sheetEditorRef.current?.activateSheet({
              index: finalData.length - 1,
            });
          }, 100);
        },
      });
    }
  };

  reader.readAsText(file);
};
