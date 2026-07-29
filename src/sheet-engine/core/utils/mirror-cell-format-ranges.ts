import produce from 'immer';
import type { Context } from '../context';
import { getSheetIndex } from '../utils';
import { getActiveDraftContext } from './active-draft-context';
import {
  rangesEqual,
  type CellFormatRange,
} from './range-format';

/**
 * Keep workbook config.cellFormatRanges aligned with a ydoc commit.
 * Cheap no-op when already equal. Mutates ctx in place (immer draft or produce).
 */
export function mirrorCellFormatRangesIntoContext(
  ctx: Context,
  sheetId: string,
  ranges: CellFormatRange[],
): boolean {
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return false;
  const file = ctx.luckysheetfile[index];
  if (!file) return false;

  file.config ||= {};
  const next = ranges ?? [];
  const fileChanged = !rangesEqual(file.config.cellFormatRanges, next);
  if (fileChanged) {
    file.config.cellFormatRanges = next;
  }

  let ctxChanged = false;
  if (ctx.currentSheetId === sheetId) {
    ctx.config ||= {};
    if (!rangesEqual(ctx.config.cellFormatRanges, next)) {
      ctx.config.cellFormatRanges = next;
      ctxChanged = true;
    }
  }

  return fileChanged || ctxChanged;
}

export type CellFormatRangesCommit = {
  sheetId: string;
  ranges: CellFormatRange[];
};

/**
 * Apply ydoc-committed ranges into the live workbook.
 * Prefers the in-flight immer draft (same edit); falls back to a produce() update.
 */
export function applyCellFormatRangesCommits(
  commits: CellFormatRangesCommit[],
  setContext?: ((updater: (prev: Context) => Context) => void) | null,
): void {
  if (!commits.length) return;

  const draft = getActiveDraftContext();
  if (draft) {
    for (let i = 0; i < commits.length; i += 1) {
      const { sheetId, ranges } = commits[i];
      mirrorCellFormatRangesIntoContext(draft, sheetId, ranges);
    }
    return;
  }

  if (!setContext) return;
  setContext((prev) =>
    produce(prev, (draftCtx) => {
      for (let i = 0; i < commits.length; i += 1) {
        const { sheetId, ranges } = commits[i];
        mirrorCellFormatRangesIntoContext(draftCtx, sheetId, ranges);
      }
    }),
  );
}
