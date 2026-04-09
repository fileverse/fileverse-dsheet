import { getSheetIndex } from '.';
import { Context } from '../context';

export const getFreezeState = (ctx: Context) => {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return { isRowFrozen: false, isColFrozen: false };

  const frozen = ctx.luckysheetfile[sheetIndex]?.frozen;
  const selection = ctx.luckysheet_select_save?.[0];
  if (!selection) return { isRowFrozen: false, isColFrozen: false };

  const frozenRow = frozen?.range?.row_focus;
  const frozenCol = frozen?.range?.column_focus;

  const isRowFrozen =
    typeof frozenRow === 'number' && frozenRow === selection.row_focus;

  const isColFrozen =
    typeof frozenCol === 'number' && frozenCol === selection.column_focus;

  return {
    isRowFrozen,
    isColFrozen,
  };
};

export type FreezeType =
  | 'row'
  | 'column'
  | 'both'
  | 'unfreeze-row'
  | 'unfreeze-column'
  | 'unfreeze-all';

export const toggleFreeze = (ctx: Context, type: FreezeType) => {
  const selection = ctx.luckysheet_select_save?.[0];
  if (!selection) return;

  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId)!;
  const sheet = ctx.luckysheetfile[sheetIndex];
  const frozen = sheet.frozen ?? {
    range: { row_focus: -1, column_focus: -1 },
  };

  let { row_focus, column_focus } = frozen.range ?? {
    row_focus: -1,
    column_focus: -1,
  };

  switch (type) {
    case 'row':
      row_focus = selection.row_focus ?? -1;
      break;
    case 'column':
      column_focus = selection.column_focus ?? -1;
      break;
    case 'both':
      row_focus = selection.row_focus ?? -1;
      column_focus = selection.column_focus ?? -1;
      break;
    case 'unfreeze-row':
      row_focus = -1;
      break;
    case 'unfreeze-column':
      column_focus = -1;
      break;
    case 'unfreeze-all':
      delete sheet.frozen;
      return;
    default:
      break;
  }

  const hasRow = row_focus >= 0;
  const hasCol = column_focus >= 0;

  if (!hasRow && !hasCol) {
    delete sheet.frozen;
    return;
  }
  let newType: 'row' | 'column' | 'both';

  if (hasRow && hasCol) {
    newType = 'both';
  } else if (hasRow) {
    newType = 'row';
  } else {
    newType = 'column';
  }

  sheet.frozen = {
    type: newType,
    range: {
      row_focus,
      column_focus,
    },
  };
};
