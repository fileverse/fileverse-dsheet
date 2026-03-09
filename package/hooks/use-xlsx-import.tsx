import { useEffect, useState } from 'react';
import { Workbook } from 'exceljs';
import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { migrateSheetFactoryForImport } from '../utils/migrate-new-yjs';
import { ySheetArrayToPlain } from '../utils/update-ydoc';

// @ts-expect-error, type is not available from package
import { transformExcelToLucky } from 'luckyexcel';

/** Predefined option colors for data validation dropdowns (when XLSX has no color). */
const DATA_VERIFICATION_OPTION_COLORS = [
  '228, 232, 237', // Light Gray
  '219, 233, 236', // White
  '244, 217, 227', // Pink
  '247, 229, 207', // Peach
  '217, 234, 244', // Blue
  '222, 239, 222', // Green
  '239, 239, 239', // Light Green
  '244, 230, 230', // Rose
  '247, 239, 217', // Yellow
  '230, 230, 244', // Purple
  '217, 244, 244', // Cyan
  '244, 239, 234', // Cream
];
const DEFAULT_OPTION_COLOR = DATA_VERIFICATION_OPTION_COLORS[0]; // Light Gray

/** Build dataVerification color string from option count: use color list only when options ≤ 12; if more, use only grey (first) repeated. */
function buildDataVerificationColor(optionCount: number): string {
  if (optionCount <= 0) return DEFAULT_OPTION_COLOR;
  if (optionCount > DATA_VERIFICATION_OPTION_COLORS.length) {
    return Array(optionCount).fill(DEFAULT_OPTION_COLOR).join(', ');
  }
  return DATA_VERIFICATION_OPTION_COLORS.slice(0, optionCount).join(', ');
}

/** Parse Excel A1-style address to 0-based row and column. e.g. "A1" -> { row: 0, col: 0 }, "B10" -> { row: 9, col: 1 } */
function parseA1Address(address: string): { row: number; col: number } | null {
  const match = address.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const digits = match[2];
  let col1Based = 0;
  for (let i = 0; i < letters.length; i++) {
    col1Based = col1Based * 26 + (letters.charCodeAt(i) - 64);
  }
  const row = parseInt(digits, 10) - 1;
  const col = col1Based - 1;
  return { row, col };
}

/** Map ExcelJS DataValidation to project dataVerification entry (row_column key format) */
function excelDataValidationToSheetEntry(
  address: string,
  dv: { type?: string; formulae?: any[]; prompt?: string; showInputMessage?: boolean; allowBlank?: boolean },
): { rowColKey: string; entry: Record<string, unknown> } | null {
  const parsed = parseA1Address(address);
  if (!parsed) return null;
  const { row, col } = parsed;
  const rowColKey = `${row}_${col}`;

  const type = dv.type === 'list' ? 'dropdown' : (dv.type || 'dropdown');
  const value1 =
    Array.isArray(dv.formulae) && dv.formulae.length > 0
      ? String(dv.formulae[0]).replace(/^["']|["']$/g, '').replace(/["']/g, '')
      : '';

  // When no color is preset (e.g. from XLSX): one color per option; use predefined list up to 12, then Light Gray for the rest
  const optionCount = value1 ? value1.split(',').length : 0;
  const color = buildDataVerificationColor(optionCount || 1);

  const entry: Record<string, unknown> = {
    type,
    type2: '',
    rangeTxt: address,
    value1,
    value2: '',
    validity: '',
    remote: false,
    prohibitInput: dv.type === 'list',
    hintShow: Boolean(dv.showInputMessage),
    hintValue: dv.prompt ?? '',
    color,
    checked: false,
  };
  return { rowColKey, entry };
}

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
    /** dataVerification per sheet: sheetIndex -> { row_column: entry } */
    let dataVerificationBySheet: Record<
      number,
      Record<string, Record<string, unknown>>
    > = {};

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
        // Extract hyperlinks, freeze info, cell formatting, and data validation from all worksheets
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

          // Extract data validation for this sheet (row_column keys for dataVerification)
          const dvModel = (ws as { dataValidations?: { model?: Record<string, unknown> } }).dataValidations?.model;
          console.log('dvModel', dvModel);
          if (dvModel && typeof dvModel === 'object') {
            const sheetDv: Record<string, Record<string, unknown>> = {};
            for (const [address, dv] of Object.entries(dvModel)) {
              const dvObj = dv as {
                type?: string;
                formulae?: unknown[];
                prompt?: string;
                showInputMessage?: boolean;
                allowBlank?: boolean;
              };
              const result = excelDataValidationToSheetEntry(address, dvObj);
              if (result) sheetDv[result.rowColKey] = result.entry;
            }
            if (Object.keys(sheetDv).length > 0) {
              dataVerificationBySheet[idx] = sheetDv;
            }
          }
        });

        transformExcelToLucky(
          file,
          function (exportJson: { sheets: Sheet[] }) {
            let sheets = exportJson.sheets;
            sheets.forEach((sheet, sheetIndex) => {
              const sheetDv = dataVerificationBySheet[sheetIndex];
              if (sheetDv && Object.keys(sheetDv).length > 0) {
                sheet.dataVerification = sheetDv;
              }
            });

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
            const ydoc = ydocRef.current;
            ydoc.transact(() => {
              if (importType !== 'merge-current-dsheet') {
                sheetArray.delete(0, sheetArray.length);
              }

              combinedSheets.forEach((sheet) => {
                if (sheet instanceof Y.Map) return;

                const factory = migrateSheetFactoryForImport(sheet);
                sheetArray.push([factory()]);
              });
            });

            // Update UI immediately so sync handler sees correct count before it can run
            if (ydocRef?.current) {
              const arr = ydocRef.current.getArray(dsheetId);
              const plain = ySheetArrayToPlain(arr);
              currentDataRef.current = plain;
              setForceSheetRender((prev: number) => prev + 1);
            }
            // @ts-expect-error later
            updateDocumentTitle?.(exportJson.info?.name);
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
