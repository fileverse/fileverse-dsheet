/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worksheet, RichText } from 'exceljs';

const parseColorToHex = (color: string): string | null => {
  if (!color || typeof color !== 'string') return null;
  const c = color.trim().toLowerCase();

  if (c.startsWith('#')) {
    const hex = c.replace('#', '').toUpperCase();
    if (hex.length === 3) {
      return hex
        .split('')
        .map((x) => x + x)
        .join('')
        .toUpperCase();
    }
    if (hex.length === 6) return hex;
    return null;
  }

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
  return null;
};

function buildRunFont(seg: any): Partial<RichText['font']> | undefined {
  const font: any = {};

  if (seg.bl === 1) font.bold = true;
  if (seg.it === 1) font.italic = true;
  if (seg.un === 1) font.underline = true;
  if (seg.cl === 1) font.strike = true;
  if (seg.fs) font.size = Number(seg.fs);
  if (typeof seg.ff === 'string' && seg.ff) font.name = seg.ff;
  if (seg.fc) {
    const hex = parseColorToHex(seg.fc);
    if (hex) font.color = { argb: `FF${hex}` };
  }

  return Object.keys(font).length > 0 ? font : undefined;
}

export type CellRichTextValue = { richText: RichText[] };

/**
 * Convert a Fortune/Luckysheet `ct.s` rich text array into an ExcelJS
 * CellRichTextValue. Returns null if there are no non-empty runs.
 */
export function buildExcelJsRichText(ctS: any[]): CellRichTextValue | null {
  if (!Array.isArray(ctS) || ctS.length === 0) return null;

  const runs: RichText[] = [];
  for (const seg of ctS) {
    // Ensure text is always a string (seg.v can be undefined/null/number)
    const text = String(seg.v ?? '');
    if (text === '' && !seg.bl && !seg.it && !seg.un && !seg.cl) continue;
    const font = buildRunFont(seg);
    const run: RichText = { text };
    if (font) run.font = font;
    runs.push(run);
  }

  if (runs.length === 0) return null;

  // Guard: if no run has actual text content, the ct.s array is styling-only
  // (Fortune stores cell-level styles in ct.s with empty text for plain cells).
  // Applying empty rich text would overwrite the valid v.v plain text → empty cell.
  if (!runs.some((r) => r.text !== '')) return null;

  return { richText: runs };
}

/**
 * Apply rich text values collected during Pass 1 to an ExcelJS worksheet.
 * Cell-level styles (fill, borders, alignment) from xlsx-js-style are preserved
 * because ExcelJS stores value and style independently.
 */
export function applyRichTextToWorksheet(
  ws: Worksheet,
  richTextMap: Map<string, CellRichTextValue>,
): void {
  richTextMap.forEach((richTextValue, cellAddress) => {
    const cell = ws.getCell(cellAddress);
    cell.value = richTextValue;
  });
}
