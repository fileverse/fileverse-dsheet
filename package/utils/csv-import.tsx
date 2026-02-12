// @ts-nocheck
import Papa from 'papaparse';
import { Sheet } from '@fileverse-dev/fortune-react';
import React from 'react';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

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

    if (typeof csvContent === 'string') {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
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

          // Add data rows
          let maxRow = 0;
          let maxCol = 0;
          const urlRegex = /^https?:\/\/\S+$/i;
          const hyperlinkMap: Record<
            string,
            { linkType: string; linkAddress: string }
          > = {};
          results.data.forEach((row, rowIndex) => {
            headers.forEach((header, colIndex) => {
              const cellValue = (row as Record<string, string | number | null>)[
                header
              ];
              const cellStr =
                cellValue !== null && cellValue !== undefined
                  ? cellValue.toString()
                  : null;
              const isUrl = cellStr && urlRegex.test(cellStr);
              cellData.push({
                r: rowIndex + 1, // +1 because header is row 0
                c: colIndex,
                v: {
                  m: cellStr,
                  ct: {
                    fa: 'General',
                    t: 'g',
                  },
                  v: cellStr,
                  ...(isUrl && { fc: 'rgb(0, 0, 255)', un: 1 }),
                },
              });
              // Detect URLs and store as hyperlinks
              if (isUrl) {
                hyperlinkMap[`${rowIndex + 1}_${colIndex}`] = {
                  linkType: 'webpage',
                  linkAddress: cellStr,
                };
              }
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
            ...(Object.keys(hyperlinkMap).length > 0 && {
              hyperlink: hyperlinkMap,
            }),
          };

          updateDocumentTitle?.(file.name);
          let finalData;
          if (importType === 'merge-current-dsheet') {
            finalData = [...data, sheetObject as Sheet];
          } else {
            finalData = [sheetObject as Sheet];
          }
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
