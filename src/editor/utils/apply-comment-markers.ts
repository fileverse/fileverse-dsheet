import { CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';

type CommentData = object | null | undefined;

/**
 * Resolves a comment for a cell using the three historical key formats.
 *
 * Comment keys are built as `${sheet.id | order | index}_${row}_${col}` in the
 * host app. `id` (UUID) is the modern, reorder-safe primary key; `order` and the
 * array `index` are kept as fallbacks for legacy keys.
 */
const resolveComment = (
  commentData: CommentData,
  sheetKey: string,
  sheetOrder: number,
  index: number,
  row: number,
  col: number,
): unknown =>
  // Primary: UUID-based key (new, immutable)
  (commentData as any)?.[`${sheetKey}_${row}_${col}`] ??
  // Legacy: order-based key (old, breaks on reorder)
  (commentData as any)?.[`${sheetOrder}_${row}_${col}`] ??
  // Very-old: array-index fallback
  (commentData as any)?.[`${index}_${row}_${col}`];

/**
 * Stamps the in-cell comment marker (`cell.ps`) onto sheet data, derived from
 * the consumer-provided `commentData`.
 *
 * `ps` is a per-client, permission-gated *view overlay* — it is NOT persisted in
 * ydoc. Every path that rebuilds sheet data from ydoc (portal load, collab sync
 * remount, remote cell edits) produces cells WITHOUT `ps`, so this must run on
 * each such snapshot or the red-triangle indicator vanishes. Because it is
 * gated on the local `allowComments` permission, it must never be written back
 * to shared ydoc state — doing so would let one viewer wipe markers for all.
 *
 * Handles both shapes:
 * - Dense `sheet.data` (the live active sheet in `luckysheetfile`).
 * - Sparse `sheet.celldata` (plain snapshots from `ySheetArrayToPlain`, and
 *   inactive sheets). `initSheetData()` converts celldata → data on activation,
 *   so `ps` set on celldata carries through.
 *
 * Mutates in place and returns the same array.
 */
export const applyCommentMarkers = <T>(
  sheets: T | null | undefined,
  commentData: CommentData,
  allowComments: boolean | undefined,
): T | null | undefined => {
  if (!Array.isArray(sheets)) return sheets;

  (sheets as any[]).forEach((sheet, index) => {
    if (!sheet) return;
    const sheetKey = (sheet.id as any)?.toString?.() ?? String(index);
    const sheetOrder = typeof sheet.order === 'number' ? sheet.order : index;

    const markerFor = (row: number, col: number) => {
      const comment = resolveComment(
        commentData,
        sheetKey,
        sheetOrder,
        index,
        row,
        col,
      );
      // Fresh object per cell: `ps` is mutated by the library on interaction
      // (isShow/left/top/…), so cells must not share one reference.
      return comment && allowComments
        ? { ...CELL_COMMENT_DEFAULT_VALUE }
        : undefined;
    };

    // Find every cell on this sheet that has a comment. We need this list
    // because an empty cell has no cell object, so the loops below can't add
    // the comment marker to it unless we know it should have one.
    const commentedCells: Array<[number, number]> = [];
    if (commentData && allowComments) {
      const prefixes = new Set([sheetKey, String(sheetOrder), String(index)]);
      Object.keys(commentData as Record<string, unknown>).forEach((key) => {
        const parts = key.split('_');
        if (parts.length !== 3) return; // not a cell comment (e.g. WITHOUT_CELL_*)
        const [prefix, rowStr, colStr] = parts;
        if (!prefixes.has(prefix)) return; // comment is for a different sheet
        const row = Number(rowStr);
        const col = Number(colStr);
        if (Number.isNaN(row) || Number.isNaN(col)) return;
        commentedCells.push([row, col]);
      });
    }

    // Active sheet: dense data grid.
    if (Array.isArray(sheet.data)) {
      sheet.data.forEach((rowArr: any[], row: number) => {
        rowArr?.forEach((cell: any, col: number) => {
          if (!cell) return;
          cell.ps = markerFor(row, col);
        });
      });
      // An empty cell is `null`, so the loop above skipped it. Create a tiny
      // cell object just to hold the comment marker, so the indicator shows
      // again after a refresh.
      commentedCells.forEach(([row, col]) => {
        const rowArr = (sheet.data as any[])[row];
        if (!rowArr) return; // cell is outside the current grid — skip
        if (rowArr[col]) return; // real cell exists, already handled above
        // This cell is only for showing the marker. A viewer's own comment
        // never reaches here again (their comment isn't saved to the doc). It
        // only fires for an empty cell whose comment lives in the host's
        // comment store but not in the doc — a marker-only cell, which the
        // doc already treats as a valid thing to keep.
        rowArr[col] = { ps: { ...CELL_COMMENT_DEFAULT_VALUE } };
      });
      return;
    }

    // Inactive sheets / plain snapshots: sparse celldata.
    if (Array.isArray(sheet.celldata)) {
      sheet.celldata.forEach((entry: any) => {
        if (!entry?.v) return;
        entry.v.ps = markerFor(entry.r, entry.c);
      });
      // Same empty-cell problem here: if a commented cell has no entry, add a
      // small entry that only carries the marker.
      const present = new Set(
        (sheet.celldata as any[]).map((e) => `${e?.r}_${e?.c}`),
      );
      commentedCells.forEach(([row, col]) => {
        if (present.has(`${row}_${col}`)) return; // entry already exists
        (sheet.celldata as any[]).push({
          r: row,
          c: col,
          v: { ps: { ...CELL_COMMENT_DEFAULT_VALUE } },
        });
      });
    }
  });

  return sheets;
};
