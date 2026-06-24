import { getFlowdata } from '@sheet-engine/core';

type SheetEditorRefLike =
  | { current: { getWorkbookSetContext?: () => unknown } | null }
  | null
  | undefined;

type SetContextFn = (mutator: (context: unknown) => void) => void;

const getSetContext = (
  sheetEditorRef: SheetEditorRefLike,
): SetContextFn | undefined => {
  const editor = sheetEditorRef?.current as
    | { getWorkbookSetContext?: () => SetContextFn }
    | null
    | undefined;
  return editor?.getWorkbookSetContext?.();
};

const cellMarkerNodeId = (row: number, col: number) =>
  `comment-box-${row}_${col}`;

const hideCellMarkerNode = (row: number, col: number) => {
  if (typeof document === 'undefined') return;
  document
    .getElementById(cellMarkerNodeId(row, col))
    ?.style.setProperty('display', 'none');
};

const showCellMarkerNode = (row: number, col: number) => {
  if (typeof document === 'undefined') return;
  document
    .getElementById(cellMarkerNodeId(row, col))
    ?.style.removeProperty('display');
};

/**
 * Clears the comment indicator from a cell.
 *
 * - Hides the package-rendered marker DOM node immediately so the user sees
 *   the change without waiting for a re-render.
 * - Sets `cell.ps = undefined` in the workbook model so the dsheet package
 *   stops drawing the marker on subsequent renders / persists.
 *
 * Used on top-level comment delete and on top-level comment resolve.
 */
export const hideCellCommentMarker = (
  sheetEditorRef: SheetEditorRefLike,
  row: number,
  col: number,
) => {
  hideCellMarkerNode(row, col);

  const setContext = getSetContext(sheetEditorRef);
  if (!setContext) return;

  setContext((context) => {
    const cell = (
      getFlowdata(context as never) as
        | Array<Array<{ ps?: unknown } | null>>
        | null
        | undefined
    )?.[row]?.[col];
    if (!cell) return;
    cell.ps = undefined;
  });
};

/**
 * Restores the comment indicator on a cell.
 *
 * - Removes the inline `display: none` we set on hide so the package's marker
 *   DOM node becomes visible again if it still exists.
 * - Re-creates a minimal `cell.ps` stub in the workbook model so the package
 *   redraws the marker on next render. Geometry fields are `null` so the
 *   package recomputes them; the existing `ps` is preserved if already set.
 *
 * Used on top-level comment unresolve.
 */
export const showCellCommentMarker = (
  sheetEditorRef: SheetEditorRefLike,
  row: number,
  col: number,
  value = '',
) => {
  showCellMarkerNode(row, col);

  const setContext = getSetContext(sheetEditorRef);
  if (!setContext) return;

  setContext((context) => {
    const cell = (
      getFlowdata(context as never) as
        | Array<Array<{ ps?: unknown } | null>>
        | null
        | undefined
    )?.[row]?.[col];
    if (!cell) return;
    if (cell.ps) return;
    cell.ps = {
      left: null,
      top: null,
      width: null,
      height: null,
      value,
      isShow: false,
    };
  });
};
