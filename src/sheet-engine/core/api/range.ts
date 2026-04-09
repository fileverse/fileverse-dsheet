import _ from 'lodash';
import { getdatabyselection, getFlowdata, getRangetxt, Selection } from '..';
import { Context } from '../context';
import { normalizeSelection, rangeValueToHtml } from '../modules';
import { Cell, Range, SingleRange } from '../types';
import { setCellFormat, setCellValue } from './cell';
import { CommonOptions, getSheet } from './common';
import { INVALID_PARAMS } from './errors';

export function getSelection(ctx: Context) {
  return ctx.luckysheet_select_save?.map((selection) => ({
    row: selection.row,
    column: selection.column,
  }));
}

export function getFlattenRange(ctx: Context, range?: Range) {
  range = range || getSelection(ctx);

  const result: { r: number; c: number }[] = [];

  range?.forEach((ele) => {
    const rs = ele.row;
    const cs = ele.column;
    for (let r = rs[0]; r <= rs[1]; r += 1) {
      for (let c = cs[0]; c <= cs[1]; c += 1) {
        result.push({ r, c });
      }
    }
  });
  return result;
}

export function getCellsByFlattenRange(
  ctx: Context,
  range?: { r: number; c: number }[],
) {
  range = range || getFlattenRange(ctx);

  const flowdata = getFlowdata(ctx);
  if (!flowdata) return [];
  return range.map((item) => flowdata[item.r]?.[item.c]);
}

export function getSelectionCoordinates(ctx: Context) {
  const result: string[] = [];
  const rangeArr = _.cloneDeep(ctx.luckysheet_select_save);
  const sheetId = ctx.currentSheetId;

  rangeArr?.forEach((ele) => {
    const rangeText = getRangetxt(ctx, sheetId, {
      column: ele.column,
      row: ele.row,
    });
    result.push(rangeText);
  });

  return result;
}

export function getCellsByRange(
  ctx: Context,
  range: Selection,
  options: CommonOptions = {},
) {
  const sheet = getSheet(ctx, options);

  if (!range || typeof range === 'object') {
    return getdatabyselection(ctx, range, sheet.id!);
  }
  throw INVALID_PARAMS;
}

export function getHtmlByRange(
  ctx: Context,
  range: Range,
  options: CommonOptions = {},
) {
  const sheet = getSheet(ctx, options);
  return rangeValueToHtml(ctx, sheet.id!, range);
}

export function setSelection(
  ctx: Context,
  range: Range,
  options: CommonOptions,
) {
  const sheet = getSheet(ctx, options);
  sheet.luckysheet_select_save = normalizeSelection(ctx, range);
  if (ctx.currentSheetId === sheet.id) {
    ctx.luckysheet_select_save = sheet.luckysheet_select_save;
  }
}

export function setCellValuesByRange(
  ctx: Context,
  data: any[][],
  range: SingleRange,
  cellInput: HTMLDivElement | null,

  options: CommonOptions = {},
  callAfterUpdate?: boolean,
) {
  if (data == null) {
    throw INVALID_PARAMS;
  }

  if (range instanceof Array) {
    throw new Error('setCellValuesByRange does not support multiple ranges');
  }

  if (!_.isPlainObject(range)) {
    throw INVALID_PARAMS;
  }

  const rowCount = range.row[1] - range.row[0] + 1;
  const columnCount = range.column[1] - range.column[0] + 1;

  if (data.length !== rowCount || data[0].length !== columnCount) {
    throw new Error('data size does not match range');
  }

  const sheet = getSheet(ctx, options);
  const sheetId = sheet.id || ctx.currentSheetId;
  const cellChanges: {
    sheetId: string;
    path: string[];
    key?: string;
    value: any;
    type?: 'update' | 'delete';
  }[] = [];

  for (let i = 0; i < rowCount; i += 1) {
    for (let j = 0; j < columnCount; j += 1) {
      const row = range.row[0] + i;
      const column = range.column[0] + j;
      setCellValue(
        ctx,
        row,
        column,
        data[i][j],
        cellInput,
        options,
        callAfterUpdate,
      );
      if (ctx?.hooks?.updateCellYdoc && sheet.data) {
        cellChanges.push({
          sheetId,
          path: ['celldata'],
          value: { r: row, c: column, v: sheet.data?.[row]?.[column] ?? null },
          key: `${row}_${column}`,
          type: 'update',
        });
      }
    }
  }

  if (cellChanges.length > 0 && ctx?.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(cellChanges);
  }
}

export function setCellFormatByRange(
  ctx: Context,
  attr: keyof Cell,
  value: any,
  range: Range | SingleRange,
  options: CommonOptions = {},
) {
  if (_.isPlainObject(range)) {
    range = [range as SingleRange];
  }

  if (!_.isArray(range)) {
    throw INVALID_PARAMS;
  }

  range.forEach((singleRange) => {
    for (let r = singleRange.row[0]; r <= singleRange.row[1]; r += 1) {
      for (let c = singleRange.column[0]; c <= singleRange.column[1]; c += 1) {
        setCellFormat(ctx, r, c, attr, value, options);
      }
    }
  });
}
