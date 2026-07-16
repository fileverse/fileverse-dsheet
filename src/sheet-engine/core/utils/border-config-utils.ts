import { cfSplitRange } from '../modules/conditionalFormat';
import type { Context } from '../context';

export type BorderSelection = {
  row: [number, number];
  column: [number, number];
};

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
