import type { CellMatrix } from '../types';

type MergeEntry = {
  r?: number;
  c?: number;
  rs?: number;
  cs?: number;
};

/**
 * Rebuild merge anchor + shadow `mc` refs on dense data from config.merge.
 * Cheap: O(merge area), not O(grid). Safe to call on every hydrate — idempotent.
 * Covers docs whose shadow cells were dropped by earlier compaction.
 */
export function applyMergeConfigToData(
  data: CellMatrix | null | undefined,
  merge: Record<string, MergeEntry> | null | undefined,
): void {
  if (!data?.length || !merge) return;

  const entries = Object.values(merge);
  for (let i = 0; i < entries.length; i += 1) {
    const v = entries[i];
    const r = v?.r;
    const c = v?.c;
    const rs = v?.rs;
    const cs = v?.cs;
    if (
      typeof r !== 'number' ||
      typeof c !== 'number' ||
      typeof rs !== 'number' ||
      typeof cs !== 'number' ||
      rs < 1 ||
      cs < 1
    ) {
      continue;
    }

    for (let row = r; row < r + rs; row += 1) {
      const dataRow = data[row];
      if (!dataRow) continue;
      for (let col: number = c; col < c + cs; col += 1) {
        if (row === r && col === c) {
          dataRow[col] = { ...(dataRow[col] || {}), mc: { r, c, rs, cs } };
        } else {
          dataRow[col] = { ...(dataRow[col] || {}), mc: { r, c } };
        }
      }
    }
  }
}
