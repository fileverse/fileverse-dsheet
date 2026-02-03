// @ts-nocheck
import Papa from 'papaparse';
import { Sheet } from '@fileverse-dev/fortune-react';
import React from 'react';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { encode } from 'punycode';
import { migrateSheetArrayForImport, migrateSheetFactory } from '../utils/migrate-new-yjs';
import { ySheetArrayToPlain } from '../utils/update-ydoc';


export const handleCSVUpload = (
  event: React.ChangeEventHandler<HTMLInputElement> | undefined,
  ydoc: Y.Doc | null,
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>,
  dsheetId: string,
  currentDataRef: React.MutableRefObject<object | null>,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
  updateDocumentTitle?: (title: string) => void,
  fileArg?: File,
  importType?: string,
  handleContentPortal?: any
) => {
  const input = event?.target;
  if (!input?.files?.length && !fileArg) {
    return;
  }
  const file = input?.files[0] || fileArg;

  const reader = new FileReader({ encoded: 'UTF-8' });
  reader.onload = (e) => {
    if (!e.target) {
      console.error('FileReader event target is null');
      return;
    }
    const csvContent = e.target.result;
    console.log('csvContent', csvContent);

    if (typeof csvContent === 'string') {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('results', results);
          if (results.errors.length > 0 && results.data.length === 0) {
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
            const renamedHeadersKeys = results.meta.renamedHeaders
              ? Object.keys(results.meta.renamedHeaders)
              : [];
            const header = renamedHeadersKeys.includes(headerV)
              ? results.meta.renamedHeaders[headerV]
              : headerV;
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
            };
          });

          headerRow.forEach((cell) => {
            cellData.push(cell);
          });

          console.log('headerRow', headerRow, results.data);

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
            id: crypto.randomUUID(),
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

          updateDocumentTitle?.(file.name);
          let finalData;
          if (importType === 'merge-current-dsheet') {
            finalData = [...data, sheetObject as Sheet];
          } else {
            finalData = [sheetObject as Sheet];
          }
          console.log('finalData before insert', finalData,);
          //const r = migrateSheetArrayForImport(finalData);

          console.log('finalData after insert',);

          // ydoc.transact(() => {
          //   sheetArray.delete(0, sheetArray.length);

          //   finalData.forEach((sheet) => {
          //     const factory = migrateSheetFactory(sheet);
          //     sheetArray.push([factory()]); // 🔥 created + attached
          //   });
          // });
          ydoc.transact(() => {
            if (importType !== 'merge-current-dsheet') {
              sheetArray.delete(0, sheetArray.length);
            }

            finalData.forEach((sheet) => {
              // 🔴 skip existing Yjs sheets
              if (sheet instanceof Y.Map) return;

              const factory = migrateSheetFactory(sheet);
              sheetArray.push([factory()]);
            });
          });

          const plain = ySheetArrayToPlain(ydoc.getArray(dsheetId));
          currentDataRef.current = plain;
          console.log('whyyyy portal missing', handleContentPortal, sheetArray, plain);
          // migrateSheetArrayForImport(ydoc, sheetArray, dsheetId, handleContentPortal);
          console.log('now finalData', finalData, ydoc.getArray(dsheetId).toArray(), handleContentPortal);
          console.log('last finalData', ydoc.getArray(dsheetId).toArray());
          setTimeout(() => {
            if (handleContentPortal) {
              handleContentPortal(finalData);
            }
            setForceSheetRender((prev: number) => prev + 1);
          }, 200)
          setTimeout(() => {
            sheetEditorRef.current?.activateSheet({
              index: finalData.length - 1,
            });
          }, 500);
        },
      });
    }
  };

  reader.readAsText(file);
};
