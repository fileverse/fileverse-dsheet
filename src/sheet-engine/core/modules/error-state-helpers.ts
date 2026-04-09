import _ from 'lodash';
import { Context, getFlowdata } from '../context';
import { colLocation, rowLocation } from './location';
import { mergeBorder } from './cell';
import { CellError } from '../types';

export function overShowError(
  ctx: Context,
  e: MouseEvent,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement,
  container: HTMLDivElement,
) {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;

  const { scrollLeft } = scrollX;
  const { scrollTop } = scrollY;
  const rect = container.getBoundingClientRect();

  const x = e.pageX - rect.left - ctx.rowHeaderWidth + scrollLeft;
  const y = e.pageY - rect.top - ctx.columnHeaderHeight + scrollTop;

  let r = rowLocation(y, ctx.visibledatarow)[2];
  let c = colLocation(x, ctx.visibledatacolumn)[2];

  const merge = mergeBorder(ctx, flowdata, r, c);
  if (merge) {
    [, , r] = merge.row;
    [, , c] = merge.column;
  }

  // don’t show hover popover on the focused (active) cell
  const firstSelection = ctx.luckysheet_select_save?.[0];
  const row_focus = firstSelection?.row_focus!;
  const col_focus = firstSelection?.column_focus!;
  if (r === row_focus && c === col_focus) {
    ctx.hoverErrorBox = undefined;
    return;
  }

  const row_column = `${r}_${c}`;
  const cell = flowdata[r]?.[c];
  const err = cell?.error;

  const errorAlreadyListed = Array.isArray(ctx.errorBoxes)
    ? _.findIndex(ctx.errorBoxes, (v) => v.row_column === row_column) !== -1
    : false;

  if (!err || errorAlreadyListed) {
    ctx.hoverErrorBox = undefined;
    return;
  }

  if (ctx.hoverErrorBox?.row_column === row_column) return;

  let rowTop = r - 1 === -1 ? 0 : ctx.visibledatarow[r - 1];
  let colLeft = ctx.visibledatacolumn[c];
  if (merge) {
    [rowTop] = merge.row;
    [, colLeft] = merge.column;
  }

  const toX = colLeft;
  const toY = rowTop;

  const zoom = ctx.zoomRatio;

  const left = err.left == null ? toX + 8 * zoom : err.left * zoom;
  let top = err.top == null ? toY - 2 * zoom : err.top * zoom;
  if (top < 0) top = 2;

  ctx.hoverErrorBox = {
    row_column,
    left,
    top,
    title: cell.error?.title || 'Error',
    message: cell.error?.message || 'Default error message',
  };
}

export function setCellError(
  ctx: Context,
  r: number,
  c: number,
  err: CellError,
) {
  const flow = getFlowdata(ctx);
  if (!flow) return;
  if (!flow[r]) flow[r] = [];
  if (!flow[r][c]) flow[r][c] = {};
  flow[r][c]!.error = { ...err };
}

export function clearCellError(ctx: Context, r: number, c: number) {
  const flow = getFlowdata(ctx);
  if (!flow?.[r]?.[c]) return;
  delete flow[r][c]!.error;
}
