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
        // Extract hyperlinks, freeze info, and cell formatting from all worksheets
        const hyperlinksBySheet: Record<
          number,
          Record<string, { linkType: string; linkAddress: string }>
        > = {};
        const frozenBySheet: Record<
          number,
          {
            type:
              | 'row'
              | 'column'
              | 'both'
              | 'rangeRow'
              | 'rangeColumn'
              | 'rangeBoth';
            range: { row_focus: number; column_focus: number };
          }
        > = {};
        const cellStylesBySheet: Record<
          number,
          Record<
            string,
            {
              bl?: number;
              it?: number;
              fs?: number;
              ff?: string;
              fc?: string;
              bg?: string;
              un?: number;
            }
          >
        > = {};
        workbook.eachSheet((ws, sheetIndex) => {
          const idx = sheetIndex - 1; // exceljs is 1-based

          // Hyperlinks
          const sheetHyperlinks: Record<
            string,
            { linkType: string; linkAddress: string }
          > = {};

          // Freeze panes from worksheet views
          const views = ws.views;
          if (views && views.length > 0) {
            const view = views[0];
            if (view.state === 'frozen') {
              const xSplit = view.xSplit || 0;
              const ySplit = view.ySplit || 0;
              let type: 'rangeRow' | 'rangeColumn' | 'rangeBoth' | null = null;
              if (xSplit > 0 && ySplit > 0) type = 'rangeBoth';
              else if (ySplit > 0) type = 'rangeRow';
              else if (xSplit > 0) type = 'rangeColumn';
              if (type) {
                frozenBySheet[idx] = {
                  type,
                  range: {
                    row_focus: ySplit - 1,
                    column_focus: xSplit - 1,
                  },
                };
              }
            }
          }

          // Cell-level formatting and hyperlinks
          const styles: Record<
            string,
            {
              bl?: number;
              it?: number;
              fs?: number;
              ff?: string;
              fc?: string;
              bg?: string;
              un?: number;
            }
          > = {};
          ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const key = `${rowNumber - 1}_${colNumber - 1}`;

              if (cell.hyperlink) {
                sheetHyperlinks[key] = {
                  linkType: 'webpage',
                  linkAddress: cell.hyperlink,
                };
              }

              // Extract cell formatting
              const font = cell.style?.font;
              const fill = cell.style?.fill;
              const cellStyle: Record<string, string | number> = {};

              if (font) {
                if (font.bold) cellStyle.bl = 1;
                if (font.italic) cellStyle.it = 1;
                if (font.underline) cellStyle.un = 1;
                if (font.size) cellStyle.fs = font.size;
                if (font.name) cellStyle.ff = font.name;
                if (font.color?.argb) {
                  const argb = font.color.argb;
                  const hex = '#' + argb.substring(argb.length - 6);
                  cellStyle.fc = hex;
                }
              }
              if (
                fill?.type === 'pattern' &&
                fill.pattern === 'solid' &&
                fill.fgColor
              ) {
                if (fill.fgColor.argb) {
                  const argb = fill.fgColor.argb;
                  const hex = '#' + argb.substring(argb.length - 6);
                  cellStyle.bg = hex;
                }
              }
              if (Object.keys(cellStyle).length > 0) {
                styles[key] = cellStyle;
              }
            });
          });

          if (Object.keys(sheetHyperlinks).length > 0) {
            hyperlinksBySheet[idx] = sheetHyperlinks;
          }
          if (Object.keys(styles).length > 0) {
            cellStylesBySheet[idx] = styles;
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
              // Attach freeze pane info
              if (frozenBySheet[sheetIndex]) {
                sheet.frozen = frozenBySheet[sheetIndex];
              }
              // Attach hyperlinks extracted from exceljs for this sheet
              if (hyperlinksBySheet[sheetIndex]) {
                sheet.hyperlink = {
                  ...(sheet.hyperlink || {}),
                  ...hyperlinksBySheet[sheetIndex],
                };
              }
              // Apply cell formatting from exceljs (hyperlink styling, bold, italic, bg, etc.)
              const hlKeys = hyperlinksBySheet[sheetIndex];
              const styleKeys = cellStylesBySheet[sheetIndex];
              if ((hlKeys || styleKeys) && sheet.celldata) {
                for (const cell of sheet.celldata) {
                  const key = `${cell.r}_${cell.c}`;
                  if (cell.v) {
                    // Apply formatting extracted from exceljs
                    if (styleKeys?.[key]) {
                      Object.assign(cell.v, styleKeys[key]);
                    }
                    // Override font color + underline for hyperlink cells
                    if (hlKeys?.[key]) {
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
