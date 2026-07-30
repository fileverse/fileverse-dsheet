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
    const sheetOrder =
      typeof sheet.order === 'number' ? sheet.order : index;

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
      return comment && allowComments ? { ...CELL_COMMENT_DEFAULT_VALUE } : undefined;
    };

    // Active sheet: dense data grid.
    if (Array.isArray(sheet.data)) {
      sheet.data.forEach((rowArr: any[], row: number) => {
        rowArr?.forEach((cell: any, col: number) => {
          if (!cell) return;
          cell.ps = markerFor(row, col);
        });
      });
      return;
    }

    // Inactive sheets / plain snapshots: sparse celldata.
    if (Array.isArray(sheet.celldata)) {
      sheet.celldata.forEach((entry: any) => {
        if (!entry?.v) return;
        entry.v.ps = markerFor(entry.r, entry.c);
      });
    }
  });

  return sheets;
};
