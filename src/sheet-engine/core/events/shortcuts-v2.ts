import _ from 'lodash';
import { Context, getFlowdata } from '../context';
import { updateCell } from '../modules/cell';
import { jfrefreshgrid } from '../modules/refresh';
import { hideSelected } from '../modules/rowcol';
import {
  rebuildRowHiddenUnion,
} from '../modules/rowVisibility';
import { changeSheet } from '../modules/sheet';
import {
  fillSelectionWithActiveValue,
  jumpHighlightCell,
} from '../modules/selection';
import {
  handleBorder,
  handleCurrencyFormat,
  handlePercentageFormat,
  handleStrikeThrough,
  updateFormat,
} from '../modules/toolbar';
import { CellMatrix, GlobalCache } from '../types';
import { isAllowEdit, getSheetIndex } from '../utils';
import { isInlineStringCell } from '../modules/inline-string';

function cellHasContent(cell: unknown): boolean {
  if (cell == null) return false;
  if (!_.isPlainObject(cell)) return !_.isNil(cell);
  const c = cell as { f?: string; v?: unknown; m?: unknown; ct?: { s?: { v?: string }[] } };
  if (c.f != null && String(c.f) !== '') return true;
  if (!_.isNil(c.v)) return true;
  if (isInlineStringCell(c as any)) {
    return (c.ct?.s ?? []).some(
      (seg) => seg?.v != null && String(seg.v).length > 0,
    );
  }
  return false;
}

function findLastUsedColInRow(flowdata: CellMatrix, row: number): number {
  for (let c = flowdata[0].length - 1; c >= 0; c -= 1) {
    if (cellHasContent(flowdata[row]?.[c])) return c;
  }
  return 0;
}

function findLastUsedCell(
  flowdata: CellMatrix,
): { row: number; col: number } {
  for (let r = flowdata.length - 1; r >= 0; r -= 1) {
    for (let c = flowdata[0].length - 1; c >= 0; c -= 1) {
      if (cellHasContent(flowdata[r]?.[c])) return { row: r, col: c };
    }
  }
  return { row: 0, col: 0 };
}

function isDigitCode(code: string, digit: string): boolean {
  return code === `Digit${digit}` || code === `Numpad${digit}`;
}

function applyNumberFormatShortcut(
  ctx: Context,
  cellInput: HTMLDivElement,
  formatFa: string,
) {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return;
  updateFormat(ctx, cellInput, flowdata, 'ct', formatFa);
}

function handleNumberFormatShortcuts(
  ctx: Context,
  cellInput: HTMLDivElement,
  e: KeyboardEvent,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return false;

  const formatByDigit: Record<string, string | (() => void)> = {
    '1': '#,##0.00',
    '2': 'h:mm:ss AM/PM',
    '3': 'm/d/yyyy',
    '4': () => {
      handleCurrencyFormat(ctx, cellInput);
    },
    '5': () => {
      handlePercentageFormat(ctx, cellInput);
    },
    '6': '0.00E+00',
  };

  for (const [digit, fmt] of Object.entries(formatByDigit)) {
    if (!isDigitCode(e.code, digit)) continue;
    if (typeof fmt === 'function') {
      fmt();
    } else {
      applyNumberFormatShortcut(ctx, cellInput, fmt);
    }
    return true;
  }
  return false;
}

function handleBorderShortcuts(ctx: Context, e: KeyboardEvent): boolean {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return false;

  if (isDigitCode(e.code, '6')) {
    handleBorder(ctx, 'border-none');
    return true;
  }

  const borderByDigit: Record<string, string> = {
    '1': 'border-top',
    '2': 'border-right',
    '3': 'border-bottom',
    '4': 'border-left',
  };

  for (const [digit, type] of Object.entries(borderByDigit)) {
    if (isDigitCode(e.code, digit)) {
      handleBorder(ctx, type);
      return true;
    }
  }
  return false;
}

function handleStrikethroughShortcut(
  ctx: Context,
  cellInput: HTMLDivElement,
  e: KeyboardEvent,
): boolean {
  if (e.metaKey && e.shiftKey && !e.altKey && e.code === 'KeyX') {
    handleStrikeThrough(ctx, cellInput);
    return true;
  }
  if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && isDigitCode(e.code, '5')) {
    handleStrikeThrough(ctx, cellInput);
    return true;
  }
  return false;
}

function unhideAllManualRows(ctx: Context) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const sheet = ctx.luckysheetfile[index];
  if (!sheet.config) sheet.config = {};
  ctx.config.rowhidden_manual = {};
  sheet.config.rowhidden_manual = {};
  rebuildRowHiddenUnion(ctx);
  sheet.config = ctx.config;
}

function unhideAllColumns(ctx: Context) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const sheet = ctx.luckysheetfile[index];
  if (!sheet.config) sheet.config = {};
  ctx.config.colhidden = {};
  sheet.config.colhidden = {};
  sheet.config = ctx.config;
}

function handleHideUnhideShortcuts(ctx: Context, e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey)) return false;

  if (e.altKey && !e.shiftKey && isDigitCode(e.code, '9')) {
    hideSelected(ctx, 'row');
    return true;
  }
  if (e.shiftKey && !e.altKey && isDigitCode(e.code, '9')) {
    unhideAllManualRows(ctx);
    return true;
  }
  if (e.altKey && !e.shiftKey && isDigitCode(e.code, '0')) {
    hideSelected(ctx, 'column');
    return true;
  }
  if (e.shiftKey && !e.altKey && isDigitCode(e.code, '0')) {
    unhideAllColumns(ctx);
    return true;
  }
  return false;
}

function handleFillRangeShortcut(
  ctx: Context,
  cellInput: HTMLDivElement,
  e: KeyboardEvent,
  cache: GlobalCache,
  canvas?: CanvasRenderingContext2D,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key !== 'Enter') {
    return false;
  }
  const filled = fillSelectionWithActiveValue(ctx, cellInput, canvas);
  if (!filled) return false;
  cache.enteredEditByTyping = false;
  return true;
}

function handleSheetNavigationShortcut(ctx: Context, e: KeyboardEvent): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;

  const sheets = _.sortBy(
    ctx.luckysheetfile.filter((s) => s.hide !== 1),
    (s) => s.order,
  );
  const currentIndex = sheets.findIndex((s) => s.id === ctx.currentSheetId);
  if (currentIndex < 0) return false;

  const nextIndex =
    e.key === 'ArrowDown'
      ? Math.min(currentIndex + 1, sheets.length - 1)
      : Math.max(currentIndex - 1, 0);
  const nextSheet = sheets[nextIndex];
  if (!nextSheet?.id || nextSheet.id === ctx.currentSheetId) return true;
  changeSheet(ctx, nextSheet.id);
  return true;
}

function handleHomeEndShortcuts(ctx: Context, e: KeyboardEvent): boolean {
  if (e.code !== 'Home' && e.code !== 'End') return false;

  const flowdata = getFlowdata(ctx);
  if (!flowdata?.length || !flowdata[0]?.length) return false;

  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  if (!last) return false;

  const curR = last.row_focus ?? last.row[0];
  const curC = last.column_focus ?? last.column[0];

  if (e.code === 'Home') {
    if (e.ctrlKey || e.metaKey) {
      jumpHighlightCell(ctx, 0, 0);
    } else {
      jumpHighlightCell(ctx, curR, 0);
    }
    return true;
  }

  if (e.ctrlKey || e.metaKey) {
    const { row, col } = findLastUsedCell(flowdata);
    jumpHighlightCell(ctx, row, col);
  } else {
    jumpHighlightCell(ctx, curR, findLastUsedColInRow(flowdata, curR));
  }
  return true;
}

/**
 * TEC-2311 shortcuts v2 — returns true when the event was handled.
 */
export function handleShortcutsV2(
  ctx: Context,
  cellInput: HTMLDivElement,
  e: KeyboardEvent,
  cache: GlobalCache,
  canvas?: CanvasRenderingContext2D,
): boolean {
  if (handleSheetNavigationShortcut(ctx, e)) {
    return true;
  }
  if (handleHomeEndShortcuts(ctx, e)) {
    return true;
  }

  if (!isAllowEdit(ctx)) return false;

  let handled = false;

  if (handleFillRangeShortcut(ctx, cellInput, e, cache, canvas)) {
    handled = true;
  } else if (handleNumberFormatShortcuts(ctx, cellInput, e)) {
    handled = true;
  } else if (handleStrikethroughShortcut(ctx, cellInput, e)) {
    handled = true;
  } else if (handleBorderShortcuts(ctx, e)) {
    handled = true;
  } else if (handleHideUnhideShortcuts(ctx, e)) {
    handled = true;
  }

  if (!handled) return false;

  jfrefreshgrid(ctx, null, undefined);
  return true;
}
