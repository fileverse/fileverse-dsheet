import React from 'react';
import SSF from 'ssf';
import { Workbook } from 'exceljs';
import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { migrateSheetFactoryForImport } from '../utils/migrate-new-yjs';
import { ySheetArrayToPlain } from '../utils/update-ydoc';

// @ts-expect-error, type is not available from package
import { transformExcelToLucky } from 'luckyexcel';
import {
  extractImagesFromWorksheet,
  convertRawImagesToFortuneSheet,
  RawSheetImage,
} from '../utils/xlsx-image-utils';

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
        // Raw image data keyed by 0-based sheet index.
        // Pixel positions are deferred to sheets.map where FortuneSheet
        // column/row dimensions are available.
        const imagesBySheet: Record<number, RawSheetImage[]> = {};

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

          // Extract images — pixel positions are deferred to sheets.map
          const sheetImages = extractImagesFromWorksheet(ws, workbook);
          if (sheetImages.length > 0) imagesBySheet[idx] = sheetImages;
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
        transformExcelToLucky(file, function (exportJson: { sheets: Sheet[] }) {
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
          const isDateCache = new Map<string, boolean>();
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
            // Attach images — convert fractional col/row to pixels using
            // FortuneSheet's actual column/row dimensions so positions match.
            if (imagesBySheet[sheetIndex]) {
              const defaultColPx =
                Number(sheet.defaultColWidth) ||
                Number(
                  sheetEditorRef.current?.getSettings?.()?.defaultColWidth,
                ) ||
                99;
              const defaultRowPx =
                Number(sheet.defaultRowHeight) ||
                Number(
                  sheetEditorRef.current?.getSettings?.()?.defaultRowHeight,
                ) ||
                21;
              sheet.images = convertRawImagesToFortuneSheet(
                imagesBySheet[sheetIndex],
                sheet,
                defaultColPx,
                defaultRowPx,
              );
            }
            // Apply cell formatting from exceljs (hyperlink styling, bold, italic, bg, etc.)
            // Also fix date cells: set ct.t="d", coerce v to number, compute m
            const hlKeys = hyperlinksBySheet[sheetIndex];
            const styleKeys = cellStylesBySheet[sheetIndex];
            const calcChain: { r: number; c: number; id: string }[] = [];
            // Built during the celldata loop below; only allocated when merges exist
            const celldataMap = sheet.config?.merge
              ? new Map<
                  string,
                  { r: number; c: number; v: Record<string, unknown> }
                >()
              : null;
            if (sheet.celldata) {
              for (const cell of sheet.celldata) {
                const key = `${cell.r}_${cell.c}`;
                celldataMap?.set(
                  key,
                  cell as {
                    r: number;
                    c: number;
                    v: Record<string, unknown>;
                  },
                );
                if (cell.v) {
                  // Mark formula cells so FortuneSheet recalculates them on dependency change
                  if (cell.v.f && cell.v.ct?.t !== 'd') {
                    cell.v.ct = { ...(cell.v.ct ?? {}), t: 'str' };
                    calcChain.push({
                      r: cell.r,
                      c: cell.c,
                      id: sheet.id as string,
                    });
                  }
                  // Apply formatting extracted from exceljs
                  if (styleKeys?.[key]) {
                    Object.assign(cell.v, styleKeys[key]);
                  }
                  // Override font color + underline for hyperlink cells
                  if (hlKeys?.[key]) {
                    cell.v.fc = 'rgb(0, 0, 255)';
                    cell.v.un = 1;
                  }
                  // Fix date cells: luckyexcel leaves ct.t unset and v as a string
                  const fa = cell.v.ct?.fa;
                  if (fa && !isDateCache.has(fa)) {
                    isDateCache.set(fa, SSF.is_date(fa));
                  }
                  if (fa && isDateCache.get(fa)) {
                    const numV =
                      typeof cell.v.v === 'string'
                        ? parseFloat(cell.v.v)
                        : cell.v.v;
                    if (typeof numV === 'number' && !isNaN(numV)) {
                      try {
                        cell.v.v = numV;
                        cell.v.m = SSF.format(fa, numV);
                        cell.v.ct = { ...cell.v.ct, t: 'd' };
                      } catch {
                        // malformed format string — leave cell as-is
                      }
                    }
                    // luckyexcel stores numeric values as strings (e.g. "59.0"); parse to number and recompute m so integers don't display with a trailing ".0"
                  } else if (
                    typeof cell.v.v === 'string' &&
                    cell.v.ct?.t !== 's'
                  ) {
                    const numV = parseFloat(cell.v.v as string);
                    if (isFinite(numV)) {
                      cell.v.v = numV;
                      if (!fa || fa === 'General') {
                        cell.v.m = String(numV);
                      } else {
                        try {
                          cell.v.m = SSF.format(fa, numV);
                        } catch {
                          // malformed format string — leave m as-is
                        }
                      }
                    }
                  }
                }
              }
            }

            sheet.calcChain = calcChain;

            // luckyexcel only sets config.merge but not cell-level mc properties.
            // FortuneSheet's canvas renderer needs mc on each cell in the merge range.
            // celldataMap was built during the celldata loop above (single pass).
            if (celldataMap && sheet.config?.merge && sheet.celldata) {
              for (const merge of Object.values(sheet.config.merge) as {
                r: number;
                c: number;
                rs: number;
                cs: number;
              }[]) {
                const { r, c, rs, cs } = merge;
                for (let dr = 0; dr < rs; dr++) {
                  for (let dc = 0; dc < cs; dc++) {
                    const key = `${r + dr}_${c + dc}`;
                    let cell = celldataMap.get(key);
                    if (!cell) {
                      cell = { r: r + dr, c: c + dc, v: {} };
                      sheet.celldata.push(cell as never);
                      celldataMap.set(key, cell);
                    }
                    if (!cell.v) cell.v = {};
                    cell.v.mc =
                      dr === 0 && dc === 0 ? { r, c, rs, cs } : { r, c };
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
        });
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
