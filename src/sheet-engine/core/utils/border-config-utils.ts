import { cfSplitRange } from '../modules/conditionalFormat';
import type { Context } from '../context';

export type BorderSelection = {
  row: [number, number];
  column: [number, number];
};

function compressSortedIndices(arr: number[]): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  if (arr.length === 0) return segments;
  let start = arr[0];
  let prev = arr[0];
  for (let i = 1; i < arr.length; i += 1) {
    const cur = arr[i];
    if (cur === prev || cur === prev + 1) {
      prev = cur;
      continue;
    }
    segments.push([start, prev]);
    start = cur;
    prev = cur;
  }
  segments.push([start, prev]);
  return segments;
}

/**
 * Remap borderInfo after a row/column reorder (header drag).
 * Uses the same old→new index map as remapCellFormatRanges.
 * O(border entries × span) — only runs on drag drop, not per-frame.
 */
export function remapBorderInfo(
  borderInfo: any[] | undefined,
  axis: 'row' | 'column',
  indexMap: Record<number, number>,
): any[] {
  if (!borderInfo?.length) return [];

  const next: any[] = [];
  for (let i = 0; i < borderInfo.length; i += 1) {
    const entry = borderInfo[i];
    if (!entry) continue;

    if (entry.rangeType === 'cell' && entry.value) {
      const value = { ...entry.value };
      if (axis === 'row') {
        const oldR = Number(value.row_index);
        if (Number.isFinite(oldR)) {
          value.row_index = indexMap[oldR] ?? oldR;
        }
      } else {
        const oldC = Number(value.col_index);
        if (Number.isFinite(oldC)) {
          value.col_index = indexMap[oldC] ?? oldC;
        }
      }
      next.push({ ...entry, value });
      continue;
    }

    if (entry.rangeType === 'range' && Array.isArray(entry.range)) {
      const remappedRanges: Array<{
        row: [number, number];
        column: [number, number];
      }> = [];

      for (let j = 0; j < entry.range.length; j += 1) {
        const rg = entry.range[j];
        if (!rg?.row || !rg?.column) continue;
        const axisPair = axis === 'row' ? rg.row : rg.column;
        const otherPair = axis === 'row' ? rg.column : rg.row;
        if (!Array.isArray(axisPair) || axisPair.length < 2) continue;

        let a1 = Number(axisPair[0]);
        let a2 = Number(axisPair[1]);
        if (!Number.isFinite(a1) || !Number.isFinite(a2)) continue;
        if (a1 > a2) {
          const tmp = a1;
          a1 = a2;
          a2 = tmp;
        }

        const mapped: number[] = [];
        for (let idx = a1; idx <= a2; idx += 1) {
          mapped.push(indexMap[idx] ?? idx);
        }
        mapped.sort((x, y) => x - y);
        compressSortedIndices(mapped).forEach(([s, e]) => {
          remappedRanges.push(
            axis === 'row'
              ? { row: [s, e], column: otherPair as [number, number] }
              : { row: otherPair as [number, number], column: [s, e] },
          );
        });
      }

      if (remappedRanges.length > 0) {
        next.push({ ...entry, range: remappedRanges });
      }
      continue;
    }

    next.push(entry);
  }

  return next;
}

/** Remove border entries overlapping a single selection (cell + range types). */
export function removeBorderInfoForSelection(
  borderInfo: any[],
  rowSt: number,
  rowEd: number,
  colSt: number,
  colEd: number,
): any[] {
  if (!borderInfo.length) return [];

  const kept: any[] = [];

  for (let i = 0; i < borderInfo.length; i += 1) {
    const entry = borderInfo[i];
    const bd_rangeType = entry.rangeType;

    if (bd_rangeType === 'range' && entry.borderType !== 'border-slash') {
      const bd_range = entry.range;
      let bd_emptyRange: any[] = [];

      for (let j = 0; j < bd_range.length; j += 1) {
        bd_emptyRange = bd_emptyRange.concat(
          cfSplitRange(
            bd_range[j],
            { row: [rowSt, rowEd], column: [colSt, colEd] },
            { row: [rowSt, rowEd], column: [colSt, colEd] },
            'restPart',
          ),
        );
      }

      if (bd_emptyRange.length > 0) {
        kept.push({ ...entry, range: bd_emptyRange });
      }
    } else if (bd_rangeType === 'cell') {
      const bd_r = entry.value.row_index;
      const bd_c = entry.value.col_index;

      if (!(bd_r >= rowSt && bd_r <= rowEd && bd_c >= colSt && bd_c <= colEd)) {
        kept.push(entry);
      }
    } else if (
      bd_rangeType === 'range' &&
      entry.borderType === 'border-slash' &&
      !(
        entry.range[0].row[0] >= rowSt &&
        entry.range[0].row[0] <= rowEd &&
        entry.range[0].column[0] >= colSt &&
        entry.range[0].column[0] <= colEd
      )
    ) {
      kept.push(entry);
    }
  }

  return kept.filter((entry) => entry.borderType !== 'border-none');
}

export function removeBorderInfoInSelections(
  borderInfo: any[] | undefined,
  selections: BorderSelection[],
): any[] {
  let result = borderInfo ?? [];
  selections.forEach((sel) => {
    result = removeBorderInfoForSelection(
      result,
      sel.row[0],
      sel.row[1],
      sel.column[0],
      sel.column[1],
    );
  });
  return result;
}

export function syncBorderInfoToYdoc(ctx: Context, borderInfo: any[]): void {
  if (!ctx?.hooks?.updateCellYdoc) return;
  ctx.hooks.updateCellYdoc([
    {
      sheetId: ctx.currentSheetId,
      path: ['config', 'borderInfo'],
      value: borderInfo,
      type: 'update',
    },
  ]);
}
