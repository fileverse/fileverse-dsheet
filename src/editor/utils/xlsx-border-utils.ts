import { utils as XLSXUtil } from 'xlsx-js-style';

export type BorderSide = { style: number; color?: string };

export const BORDER_STYLE_MAP: Record<number, string> = {
  1: 'thin',
  2: 'hair',
  3: 'dotted',
  4: 'dashed',
  5: 'dashDot',
  6: 'dashDotDot',
  7: 'double',
  8: 'medium',
  9: 'mediumDashed',
  10: 'mediumDashDot',
  11: 'mediumDashDotDot',
  12: 'slantDashDot',
  13: 'thick',
};

/** Normalize any hex color to a 6-char uppercase RGB string (no #). */
const normalizeHexColor = (color: unknown): string => {
  if (typeof color !== 'string') return '000000';
  const hex = color.replace('#', '').toUpperCase();
  if (hex.length === 3) return hex.replace(/(.)/g, '$1$1');
  return hex.length === 6 ? hex : '000000';
};

/** Convert a fortune border side descriptor to an xlsx-js-style border entry. */
export const toBorderSide = (style: unknown, color: unknown) => {
  const s = Number(style);
  if (!s) return undefined;
  return {
    style: BORDER_STYLE_MAP[s] ?? 'thin',
    color: { rgb: normalizeHexColor(color) },
  };
};

type XlsxBorderSide = ReturnType<typeof toBorderSide>;

/**
 * Mutates a single cell in the worksheet, applying only the requested border
 * sides. Spreads the cell and its style objects to avoid mutating frozen refs.
 */
const applyToCell = (
  worksheet: Record<string, unknown>,
  r: number,
  c: number,
  sides: { l?: boolean; r?: boolean; t?: boolean; b?: boolean },
  borderSide: XlsxBorderSide,
) => {
  if (!borderSide) return;
  if (!sides.l && !sides.r && !sides.t && !sides.b) return;
  const ref = XLSXUtil.encode_cell({ r, c });
  const cell = {
    ...((worksheet[ref] as Record<string, unknown>) || { t: 'z' }),
  };
  const s = { ...((cell.s as Record<string, unknown>) || {}) };
  const border = { ...((s.border as Record<string, unknown>) || {}) };
  if (sides.l) border.left = borderSide;
  if (sides.r) border.right = borderSide;
  if (sides.t) border.top = borderSide;
  if (sides.b) border.bottom = borderSide;
  s.border = border;
  cell.s = s;
  worksheet[ref] = cell;
};

/**
 * Reads `borderInfo` from a fortune sheet config and writes the corresponding
 * border styles into the xlsx-js-style worksheet object.
 *
 * Handles two rangeTypes:
 *  - "cell"  → per-cell border entries produced by luckyexcel on import
 *  - "range" → range border commands produced when the user draws borders in the UI
 */
export const applyBordersToWorksheet = (
  worksheet: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  borderInfo: any[],
) => {
  borderInfo.forEach((border) => {
    // ── cell type (from luckyexcel import) ──────────────────────────────────
    if (border.rangeType === 'cell') {
      if (!border.value) return;
      const { row_index: r, col_index: c } = border.value;
      if (r == null || c == null) return;
      const v = border.value as {
        l?: BorderSide;
        r?: BorderSide;
        t?: BorderSide;
        b?: BorderSide;
      };
      // Each side can have a distinct style/color, so build the border object directly.
      const ref = XLSXUtil.encode_cell({ r, c });
      const cell = {
        ...((worksheet[ref] as Record<string, unknown>) || { t: 'z' }),
      };
      const s = { ...((cell.s as Record<string, unknown>) || {}) };
      const borderObj = { ...((s.border as Record<string, unknown>) || {}) };
      if (v.l) borderObj.left = toBorderSide(v.l.style, v.l.color);
      if (v.r) borderObj.right = toBorderSide(v.r.style, v.r.color);
      if (v.t) borderObj.top = toBorderSide(v.t.style, v.t.color);
      if (v.b) borderObj.bottom = toBorderSide(v.b.style, v.b.color);
      s.border = borderObj;
      cell.s = s;
      worksheet[ref] = cell;

      // ── range type (from user drawing borders in the UI) ────────────────────
    } else if (border.rangeType === 'range') {
      const { borderType, style, color, range } = border;
      if (borderType === 'border-none' || !Array.isArray(range) || !style)
        return;
      const xlsxSide = toBorderSide(style, color);
      if (!xlsxSide) return;

      (range as { row: number[]; column: number[] }[]).forEach((rangeItem) => {
        const [r1, r2] = rangeItem.row;
        const [c1, c2] = rangeItem.column;
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            switch (borderType) {
              case 'border-all':
                applyToCell(
                  worksheet,
                  r,
                  c,
                  { l: true, r: true, t: true, b: true },
                  xlsxSide,
                );
                break;
              case 'border-outside':
                applyToCell(
                  worksheet,
                  r,
                  c,
                  { l: c === c1, r: c === c2, t: r === r1, b: r === r2 },
                  xlsxSide,
                );
                break;
              case 'border-inside':
                applyToCell(
                  worksheet,
                  r,
                  c,
                  { r: c < c2, b: r < r2 },
                  xlsxSide,
                );
                break;
              case 'border-horizontal':
                applyToCell(worksheet, r, c, { b: r < r2 }, xlsxSide);
                break;
              case 'border-vertical':
                applyToCell(worksheet, r, c, { r: c < c2 }, xlsxSide);
                break;
              case 'border-left':
                if (c === c1)
                  applyToCell(worksheet, r, c, { l: true }, xlsxSide);
                break;
              case 'border-right':
                if (c === c2)
                  applyToCell(worksheet, r, c, { r: true }, xlsxSide);
                break;
              case 'border-top':
                if (r === r1)
                  applyToCell(worksheet, r, c, { t: true }, xlsxSide);
                break;
              case 'border-bottom':
                if (r === r2)
                  applyToCell(worksheet, r, c, { b: true }, xlsxSide);
                break;
            }
          }
        }
      });
    }
  });
};
