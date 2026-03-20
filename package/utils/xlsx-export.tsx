import { utils as XLSXUtil, write as XLSXWrite } from 'xlsx-js-style';
import { Workbook as ExcelJSWorkbook } from 'exceljs';
import * as Y from 'yjs';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { MutableRefObject } from 'react';
import { getExportFilenameBase } from './export-filename';
import { applyBordersToWorksheet } from './xlsx-border-utils';

const parseColorToHex = (color: string): string | null => {
  if (!color || typeof color !== 'string') return null;

  // Trim & lowercase for detection
  const c = color.trim().toLowerCase();

  // CASE 1: Already HEX (#fff or #ffffff)
  if (c.startsWith('#')) {
    const hex = c.replace('#', '').toUpperCase();

    if (hex.length === 3) {
      // Expand shortened hex (#f00 → #FF0000)
      return hex
        .split('')
        .map((x) => x + x)
        .join('')
        .toUpperCase();
    }

    if (hex.length === 6) return hex;
    return null; // invalid hex
  }

  // -------------------------------
  // CASE 2: RGB or RGBA
  // supports:
  // rgb(255,0,0)
  // rgba(255,0,0,1)
  // rgba(255 0 0 / 1)
  // rgb(  255 , 100 ,   0 )
  // -------------------------------
  const rgbRegex =
    /rgba?\s*\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+[\d.]+)?\s*\)/i;

  const match = c.match(rgbRegex);

  if (match) {
    const r = Math.min(255, Math.max(0, parseFloat(match[1])));
    const g = Math.min(255, Math.max(0, parseFloat(match[2])));
    const b = Math.min(255, Math.max(0, parseFloat(match[3])));

    return ((1 << 24) + (r << 16) + (g << 8) + b)
      .toString(16)
      .slice(1)
      .toUpperCase();
  }

  // Unknown format → ignore styling
  return null;
};

export const handleExportToXLSX = async (
  workbookRef: MutableRefObject<WorkbookInstance | null>,
  ydocRef: MutableRefObject<Y.Doc | null>,
  dsheetId: string,
  getDocumentTitle?: () => string,
) => {
  if (!workbookRef.current || !ydocRef.current) return;

  try {
    const ydoc = ydocRef.current;
    ydoc.getArray(dsheetId);

    const sheetWithData = workbookRef.current.getAllSheets();
    const workbook = XLSXUtil.book_new();

    sheetWithData.forEach((sheet, index) => {
      const rows = sheetWithData[index]?.data || [];

      const worksheet: any = XLSXUtil.aoa_to_sheet(rows);

      // APPLY MERGED CELLS
      worksheet['!merges'] = [];
      if (sheet.config?.merge) {
        Object.values(sheet.config.merge).forEach((m: any) => {
          worksheet['!merges'].push({
            s: { r: m.r, c: m.c },
            e: { r: m.r + m.rs - 1, c: m.c + m.cs - 1 },
          });
        });
      }

      // APPLY COLUMN WIDTH
      if (sheet.config?.columnlen) {
        worksheet['!cols'] = [];
        Object.entries(sheet.config.columnlen).forEach(([col, w]) => {
          worksheet['!cols'][Number(col)] = { wpx: Number(w) };
        });
      }

      // ROW HEIGHT
      if (sheet.config?.rowlen) {
        worksheet['!rows'] = [];
        Object.entries(sheet.config.rowlen).forEach(([row, h]) => {
          worksheet['!rows'][Number(row)] = { hpx: Number(h) };
        });
      }

      // PROCESS CELL DATA
      (sheet.celldata ?? []).forEach((cell: any) => {
        const r = cell.r;
        const c = cell.c;
        const v = cell.v || {};

        const cellRef = XLSXUtil.encode_cell({ r, c });

        let newCell: any = worksheet[cellRef] || {};
        newCell = { ...newCell };

        // -----------------------------
        // VALUE + FORMULA
        // -----------------------------
        if (v.f) newCell.f = v.f.replace(/^=/, '');
        newCell.v = v.v || v?.ct?.s?.[0]?.v;
        if (v.m) newCell.w = v.m;

        // -----------------------------
        // NUMBER FORMAT
        // -----------------------------
        if (v.ct) {
          if (v.ct.fa) newCell.z = v.ct.fa;
          //xlsx needs date to be in number format, so we set type to 'n' for date cells. this fixes exporting date from dsheets
          if (v.ct.t) newCell.t = v.ct.t === 'd' ? 'n' : v.ct.t;
        }

        // -----------------------------
        // STYLE OBJECT
        // -----------------------------
        newCell.s = newCell.s || {};

        // ============ FILL ============
        if (v.bg) {
          const hex = parseColorToHex(v.bg);
          if (hex) {
            newCell.s.fill = {
              patternType: 'solid',
              fgColor: { rgb: hex },
            };
          }
        }

        // ============ FONT ============
        newCell.s.font = {
          ...(newCell.s.font || {}),
          bold: v.bl === 1 || undefined,
          italic: v.it === 1 || undefined,
          strike: v.cl === 1 || undefined,
          underline: v.un === 1 || undefined,

          sz: v.fs ?? undefined,
          name: v.ff ?? undefined,

          color: v.fc ? { rgb: v.fc.replace('#', '') } : undefined,
        };

        // ============ ALIGNMENT ============
        const HT_MAP: any = { '0': 'center', '1': 'left', '2': 'right' };
        const VT_MAP: any = { '0': 'center', '1': 'top', '2': 'bottom' };

        newCell.s.alignment = {
          ...(newCell.s.alignment || {}),
          wrapText: v.tb === '1' || v.tb === '2' ? true : undefined,
          textRotation: v.tr !== undefined ? v.tr : undefined,
        };

        newCell.s.alignment.horizontal = HT_MAP[v.ht] || undefined;
        newCell.s.alignment.vertical = VT_MAP[v.vt] || undefined;

        if (v.tb !== undefined) {
          newCell.s.alignment = newCell.s.alignment || {};

          if (v.tb === '1') {
            newCell.s.alignment.wrapText = true; // Wrap text
          } else if (v.tb === '2') {
            newCell.s.alignment.shrinkToFit = true; // Clip text
          }
          // "0" → overflow → do nothing
        }

        worksheet[cellRef] = newCell;
      });

      // APPLY BORDERS
      if (sheet.config?.borderInfo) {
        applyBordersToWorksheet(worksheet, sheet.config.borderInfo);
      }

      const subSheetName =
        sheet.name.length > 30 ? sheet.name.slice(0, 30) : sheet.name;

      XLSXUtil.book_append_sheet(workbook, worksheet, subSheetName);
    });

    const activeSheetName = workbookRef.current.getSheet()?.name;
    const title = getExportFilenameBase({
      getDocumentTitle: () => getDocumentTitle?.() ?? '',
      documentTitleFallback:
        typeof document !== 'undefined' ? document.title : '',
      sheetNameFallback: activeSheetName,
      defaultBase: 'Sheet',
    });

    // Pass 1: write to buffer with xlsx-js-style (preserves all cell styling)
    const xlsxBuffer: ArrayBuffer = XLSXWrite(workbook, {
      bookType: 'xlsx',
      type: 'array',
      compression: true,
    });

    // Pass 2: ExcelJS reads the buffer and adds data validations
    const excelWorkbook = new ExcelJSWorkbook();
    await excelWorkbook.xlsx.load(xlsxBuffer);

    sheetWithData.forEach((sheet, index) => {
      if (!sheet.dataVerification) return;
      const ws = excelWorkbook.worksheets[index];
      if (!ws) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wsAny = ws as any;
      if (!wsAny.dataValidations) wsAny.dataValidations = { model: {} };
      if (!wsAny.dataValidations.model) wsAny.dataValidations.model = {};
      const dvModel: Record<string, unknown> = wsAny.dataValidations.model;

      let cfPriority = 1;
      Object.entries(sheet.dataVerification).forEach(([rowColKey, dvRaw]) => {
        const dv = dvRaw as {
          type?: string;
          value1?: string;
          color?: string;
          hintShow?: boolean;
          hintValue?: string;
          prohibitInput?: boolean;
        };
        if (dv.type !== 'dropdown') return;
        const [row, col] = rowColKey.split('_').map(Number);
        const cellAddress = XLSXUtil.encode_cell({ r: row, c: col });
        const options = (dv.value1 || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (options.length === 0) return;

        // Write directly to the model in the same format the import reads it
        dvModel[cellAddress] = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${options.join(',')}"`],
          showInputMessage: Boolean(dv.hintShow),
          prompt: dv.hintValue || '',
          showErrorMessage: Boolean(dv.prohibitInput),
        };

        // Add conditional formatting so option colors persist in Google Sheets / Excel.
        // color is a flat comma-separated string of R, G, B triplets (one per option).
        if (dv.color) {
          const colorNums = dv.color
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10));
          const toHex2 = (n: number) =>
            Math.max(0, Math.min(255, n))
              .toString(16)
              .padStart(2, '0')
              .toUpperCase();
          const cfRules = options
            .map((option, i) => {
              const r = colorNums[i * 3];
              const g = colorNums[i * 3 + 1];
              const b = colorNums[i * 3 + 2];
              if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
              const argb = `FF${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
              return {
                type: 'cellIs',
                operator: 'equal',
                formulae: [`"${option}"`],
                priority: cfPriority++,
                style: {
                  fill: {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb },
                  },
                },
              };
            })
            .filter(Boolean);
          if (cfRules.length > 0) {
            wsAny.addConditionalFormatting({
              ref: cellAddress,
              rules: cfRules,
            });
          }
        }
      });
    });

    const finalBuffer = await excelWorkbook.xlsx.writeBuffer();
    const blob = new Blob([finalBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
  }
};
