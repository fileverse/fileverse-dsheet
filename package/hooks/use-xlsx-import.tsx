import { useEffect, useState } from 'react';
import { Workbook } from 'exceljs';
import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
// @ts-expect-error, type is not available from package
import { transformExcelToLucky } from 'luckyexcel';

export const useXLSXImport = ({
  sheetEditorRef,
  ydocRef,
  setForceSheetRender,
  dsheetId,
  currentDataRef,
  updateDocumentTitle,
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  setForceSheetRender: React.Dispatch<React.SetStateAction<number>>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  updateDocumentTitle?: (title: string) => void;
}) => {
  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [mergeInfo, setMergeInfo] = useState<Record<
    string,
    { r: number; c: number; rs: number; cs: number }
  > | null>(null);

  useEffect(() => {
    if (sheetEditorRef && sheetEditorRef.current) {
      if (sheetData.length > 0) {
        setMergeInfo(sheetData[0].config?.merge ?? null);
      }
    }
  }, [sheetData]);

  useEffect(() => {
    if (mergeInfo) {
      Object.keys(mergeInfo).forEach((key) => {
        const merge = mergeInfo[key] as {
          r: number;
          c: number;
          rs: number;
          cs: number;
        };
        const startCellAddressR = merge.r;
        const startCellAddressC = merge.c;
        const endCellAddressR = merge.r + merge.rs - 1;
        const endCellAddressC = merge.c + merge.cs - 1;
        if (sheetEditorRef && sheetEditorRef.current) {
          sheetEditorRef.current.mergeCells(
            [
              {
                row: [startCellAddressR, endCellAddressR],
                column: [startCellAddressC, endCellAddressC],
              },
            ],
            'merge-horizontal',
          );
        }
      });
    }
  }, [mergeInfo]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement> | undefined,
    fileArg: File,
    importType?: 'new-dsheet' | 'merge-current-dsheet' | 'new-current-dsheet',
  ) => {
    const input = event?.target;
    if (!input?.files?.length && !fileArg) {
      return;
    }
    const file = input?.files?.[0] || fileArg;
    let dropdownInfo: Record<
      string,
      {
        type?: string;
        formulae?: { replace: (a: RegExp, b: string) => string }[];
      }
    > | null = null;

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (!e.target) {
        console.error('FileReader event target is null');
        return;
      }
      const arrayBuffer = e.target.result;
      const workbook = new Workbook();
      try {
        //@ts-expect-error, later
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);
        // Extract hyperlinks from all worksheets, indexed by worksheet position
        const hyperlinksBySheet: Record<
          number,
          Record<string, { linkType: string; linkAddress: string }>
        > = {};
        workbook.eachSheet((ws, sheetIndex) => {
          const sheetHyperlinks: Record<
            string,
            { linkType: string; linkAddress: string }
          > = {};
          ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              if (cell.hyperlink) {
                // fortune-sheet uses 0-indexed row_col keys
                const key = `${rowNumber - 1}_${colNumber - 1}`;
                sheetHyperlinks[key] = {
                  linkType: 'webpage',
                  linkAddress: cell.hyperlink,
                };
              }
            });
          });
          if (Object.keys(sheetHyperlinks).length > 0) {
            // sheetIndex is 1-based in exceljs, store as 0-based
            hyperlinksBySheet[sheetIndex - 1] = sheetHyperlinks;
          }
        });

        dropdownInfo =
          worksheet
            ?.getSheetValues()
            ?.reduce<Record<string, object>>((acc = {}, row, rowIndex) => {
              if (row) {
                Array.isArray(row) &&
                  row.forEach((cell, colIndex) => {
                    if (
                      cell &&
                      typeof cell === 'object' &&
                      'dataValidation' in cell
                    ) {
                      const cellAddress = `${String.fromCharCode(65 + colIndex)}${rowIndex}`;
                      acc[cellAddress] =
                        (cell as { dataValidation?: object | undefined })
                          .dataValidation ?? {};
                    }
                  });
              }
              return acc;
            }, {}) || null;
        transformExcelToLucky(
          file,
          // luckysheetfile: object
          function (exportJson: { sheets: Sheet[] }) {
            let sheets = exportJson.sheets;
            for (const sheet of sheets) {
              if (dropdownInfo && Object.keys(dropdownInfo).length > 0) {
                const dataVerification: Record<string, object> = {};
                for (const key of Object.keys(dropdownInfo)) {
                  const value = dropdownInfo[key];
                  if (value.type === 'list') {
                    const splited = key.split('');
                    const col_ = splited[0].charCodeAt(0) - 65;
                    const row_ = Number(splited[1]) - 1;
                    const f_key = `${row_}_${col_}`;
                    dataVerification[f_key] = {
                      type: 'dropdown',
                      type2: '',
                      rangeTxt: key,
                      value1: value.formulae?.[0]?.replace(/["']/g, '') || '',
                      value2: '',
                      validity: '',
                      remote: false,
                      prohibitInput: true,
                      hintShow: false,
                      hintValue: '',
                      checked: false,
                    };
                  }
                }
                sheet.dataVerification = dataVerification;
              }
            }

            if (!ydocRef.current) {
              console.error('ydocRef.current is null');
              return;
            }
            const sheetArray = ydocRef.current.getArray(dsheetId);
            const localSheetsArray = Array.from(sheetArray) as Sheet[];
            sheets = sheets.map((sheet, sheetIndex) => {
              const lastCell = sheet?.celldata?.[sheet.celldata.length - 1];

              const lastRow = lastCell?.r ?? 0;
              const lastCol = lastCell?.c ?? 0;

              sheet.row = Math.max(lastRow, 500);
              sheet.column = Math.max(lastCol, 36);

              if (!sheet.id) {
                sheet.id = sheetEditorRef.current
                  ?.getSettings()
                  .generateSheetId();
              }
              if (sheet.calcChain) {
                sheet.calcChain = sheet.calcChain.map((chain) => {
                  delete chain.id;
                  delete chain.index;
                  chain.id = sheet.id;
                  return chain;
                });
              }
              // Attach hyperlinks extracted from exceljs for this sheet
              if (hyperlinksBySheet[sheetIndex]) {
                sheet.hyperlink = {
                  ...(sheet.hyperlink || {}),
                  ...hyperlinksBySheet[sheetIndex],
                };
                // Apply blue + underline styling to hyperlink cells
                const hlKeys = hyperlinksBySheet[sheetIndex];
                if (sheet.celldata) {
                  for (const cell of sheet.celldata) {
                    const key = `${cell.r}_${cell.c}`;
                    if (hlKeys[key] && cell.v) {
                      cell.v.fc = 'rgb(0, 0, 255)';
                      cell.v.un = 1;
                    }
                  }
                }
              }
              return sheet;
            });

            let combinedSheets;

            if (importType === 'merge-current-dsheet') {
              combinedSheets = [...localSheetsArray, ...sheets];
            } else {
              combinedSheets = [...sheets];
            }

            combinedSheets = combinedSheets.map((sheet, index) => {
              sheet.order = index;
              return sheet;
            });

            setSheetData(combinedSheets);
            ydocRef.current.transact(() => {
              sheetArray.delete(0, sheetArray.length);
              sheetArray.insert(0, combinedSheets);
              currentDataRef.current = combinedSheets;
            });
            // @ts-expect-error later
            updateDocumentTitle?.(exportJson.info?.name);
            setForceSheetRender((prev: number) => prev + 1);
          },
        );
      } catch (error) {
        console.error('Error loading the workbook', error);
        alert(
          'Error loading the workbook. Please ensure it is a valid .xlsx file.',
        );
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return { handleXLSXUpload: handleFileUpload };
};
