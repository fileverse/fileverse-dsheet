import { Sheet } from '@sheet-engine/react';
import { extractCellFormatAttrs } from '../../sheet-engine/core/utils/cell-persist-utils';
import {
  normalizeCellFormatRanges,
  type CellFormatRange,
} from '../../sheet-engine/core/utils/range-format';

type CelldataEntry = { r: number; c: number; v: unknown };

/**
 * XLSX imports (Google Sheets exports especially) materialize every
 * styled-but-empty cell. Move those into config.cellFormatRanges — the same
 * sparse representation the editor uses — so they never inflate celldata/Yjs.
 * Cells with content, merges, hyperlinks, notes or masks are kept verbatim.
 */
export function compactImportedSheetFormatting(sheet: Sheet): void {
  const celldata = sheet.celldata as CelldataEntry[] | undefined;
  if (!Array.isArray(celldata) || celldata.length === 0) return;

  const kept: CelldataEntry[] = [];
  const stripsByAttrs = new Map<string, Map<number, number[]>>();
  let formatOnlyCount = 0;

  for (const entry of celldata) {
    if (
      !entry ||
      typeof entry.r !== 'number' ||
      typeof entry.c !== 'number'
    ) {
      kept.push(entry);
      continue;
    }
    const attrs = extractCellFormatAttrs(
      entry.v as Parameters<typeof extractCellFormatAttrs>[0],
    );
    if (!attrs) {
      kept.push(entry);
      continue;
    }
    formatOnlyCount += 1;
    const attrsKey = JSON.stringify(attrs);
    let byColumn = stripsByAttrs.get(attrsKey);
    if (!byColumn) {
      byColumn = new Map();
      stripsByAttrs.set(attrsKey, byColumn);
    }
    let rows = byColumn.get(entry.c);
    if (!rows) {
      rows = [];
      byColumn.set(entry.c, rows);
    }
    rows.push(entry.r);
  }

  if (formatOnlyCount === 0) return;

  const strips: CellFormatRange[] = [];
  stripsByAttrs.forEach((byColumn, attrsKey) => {
    const attrs = JSON.parse(attrsKey) as Partial<CellFormatRange>;
    byColumn.forEach((rows, column) => {
      rows.sort((a, b) => a - b);
      let start = rows[0];
      let previous = rows[0];
      for (let i = 1; i <= rows.length; i += 1) {
        const row = rows[i];
        if (row === previous || row === previous + 1) {
          previous = row;
          continue;
        }
        strips.push({
          ...attrs,
          row: [start, previous],
          column: [column, column],
        });
        if (row == null) break;
        start = row;
        previous = row;
      }
    });
  });

  const existing = sheet.config?.cellFormatRanges as
    | CellFormatRange[]
    | undefined;
  const ranges = normalizeCellFormatRanges([...(existing ?? []), ...strips]);

  sheet.config = { ...(sheet.config ?? {}), cellFormatRanges: ranges };
  sheet.celldata = kept as Sheet['celldata'];
}

const stableDefKey = (entry: Record<string, unknown>): string => {
  const keys = Object.keys(entry)
    .filter((key) => key !== 'rangeTxt')
    .sort();
  return JSON.stringify(keys.map((key) => [key, entry[key]]));
};

/**
 * Imported validations repeat the full option list + per-option color string
 * on every covered cell (whole-column dropdowns → thousands of copies). Store
 * each unique entry once in dataVerificationDefs and keep numeric refs in the
 * per-cell map; expandSheetDataVerification restores objects for the engine.
 */
export function internImportedDataVerification(sheet: Sheet): void {
  const dv = sheet.dataVerification as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!dv || typeof dv !== 'object') return;
  const entries = Object.entries(dv);
  if (entries.length === 0) return;

  const defs: Record<string, unknown>[] = [];
  const defIndexByKey = new Map<string, number>();
  const interned: Record<string, unknown> = {};

  for (const [cellKey, entry] of entries) {
    if (!entry || typeof entry !== 'object') {
      interned[cellKey] = entry;
      continue;
    }
    const defKey = stableDefKey(entry);
    let index = defIndexByKey.get(defKey);
    if (index == null) {
      index = defs.length;
      defs.push(entry);
      defIndexByKey.set(defKey, index);
    }
    interned[cellKey] = index;
  }

  if (defs.length >= entries.length) return;

  sheet.dataVerification = interned;
  (sheet as Sheet & { dataVerificationDefs?: unknown[] }).dataVerificationDefs =
    defs;
}

/**
 * Resolve interned dataVerification refs back to shared entry objects before
 * the sheet reaches the engine or the XLSX exporter. No-op (and no mutation)
 * when the map already holds objects, so live workbook sheets pass through.
 */
export function expandSheetDataVerification<
  T extends {
    dataVerification?: unknown;
    dataVerificationDefs?: unknown;
  },
>(sheet: T): T {
  const defs = sheet.dataVerificationDefs;
  const dv = sheet.dataVerification;
  if (!Array.isArray(defs) || defs.length === 0) return sheet;
  if (!dv || typeof dv !== 'object' || Array.isArray(dv)) return sheet;

  const entries = Object.entries(dv as Record<string, unknown>);
  if (!entries.some(([, value]) => typeof value === 'number')) return sheet;

  const expanded: Record<string, unknown> = {};
  for (const [cellKey, value] of entries) {
    if (typeof value === 'number') {
      const def = defs[value];
      if (def != null) expanded[cellKey] = def;
      continue;
    }
    expanded[cellKey] = value;
  }
  sheet.dataVerification = expanded;
  return sheet;
}
