import _ from 'lodash';
import {
  Cell,
  CellMatrix,
  Context,
  Selection,
  getFlowdata,
  getSheetIndex,
  indexToColumnChar,
  getCellValue,
  isRealNull,
} from '..';
import { locale } from '../locale';
import { recalcAutoRowHeightForRow } from './cell';
import { delFunctionGroup } from './formula';
import { isInlineStringCell } from './inline-string';
import { clearCellError } from './error-state-helpers';
import { jfrefreshgrid } from './refresh';

export type RemoveDuplicatesError =
  | 'readOnly'
  | 'noSelection'
  | 'noMulti'
  | 'noMerge'
  | 'noColumns'
  | 'cannotDeleteAllRow';

export type RemoveDuplicatesColumnOption = {
  column: number;
  label: string;
  checked: boolean;
};

export type RemoveDuplicatesPreview = {
  range: Selection;
  columns: RemoveDuplicatesColumnOption[];
};

export type RemoveDuplicatesOptions = {
  hasHeaderRow: boolean;
  analyzedColumns: number[];
  /** Range captured when the dialog opened; avoids selection drift. */
  range?: Selection;
};

export type RemoveDuplicatesResult = {
  removedCount: number;
  remainingCount: number;
  error?: RemoveDuplicatesError;
};

function cellHasDisplayValue(cell: Cell | null | undefined): boolean {
  if (cell == null) return false;
  if (!isRealNull(cell.v)) return true;
  if (cell.m != null && String(cell.m).trim() !== '') return true;
  return false;
}

function getDisplayedCompareValue(
  d: CellMatrix,
  row: number,
  column: number,
): string {
  const cell = d[row]?.[column];
  if (cell == null) return '';
  const displayed = getCellValue(row, column, d, 'm') as
    | string
    | number
    | null
    | undefined;
  if (displayed != null && String(displayed).trim() !== '') {
    return String(displayed);
  }
  if (!isRealNull(cell.v)) {
    return String(cell.v);
  }
  return '';
}

function getSelectionRange(ctx: Context): Selection | null {
  const selection = ctx.luckysheet_select_save?.[0];
  if (!selection?.row?.length || !selection?.column?.length) {
    return null;
  }
  return selection;
}

function expandSelectionToDataRange(
  ctx: Context,
  selection: Selection,
): Selection {
  const d = getFlowdata(ctx);
  if (!d) return selection;

  let [r1, r2] = selection.row;
  let [c1, c2] = selection.column;

  if (r1 !== r2 || c1 !== c2) {
    return selection;
  }

  const maxCol = (d[0]?.length ?? 1) - 1;
  const maxRow = d.length - 1;

  const hasDataInRow = (row: number, colStart: number, colEnd: number) => {
    for (let c = colStart; c <= colEnd; c += 1) {
      if (cellHasDisplayValue(d[row]?.[c])) return true;
    }
    return false;
  };

  const hasDataInCol = (col: number, rowStart: number, rowEnd: number) => {
    for (let r = rowStart; r <= rowEnd; r += 1) {
      if (cellHasDisplayValue(d[r]?.[col])) return true;
    }
    return false;
  };

  let changed = true;
  while (changed) {
    changed = false;
    if (r1 > 0 && hasDataInRow(r1 - 1, c1, c2)) {
      r1 -= 1;
      changed = true;
    }
    if (r2 < maxRow && hasDataInRow(r2 + 1, c1, c2)) {
      r2 += 1;
      changed = true;
    }
    if (c1 > 0 && hasDataInCol(c1 - 1, r1, r2)) {
      c1 -= 1;
      changed = true;
    }
    if (c2 < maxCol && hasDataInCol(c2 + 1, r1, r2)) {
      c2 += 1;
      changed = true;
    }
  }

  return { row: [r1, r2], column: [c1, c2] };
}

function rangeHasRowSpanningMerge(
  ctx: Context,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
): boolean {
  const d = getFlowdata(ctx);
  if (!d) return false;

  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) {
      const cell = d[r]?.[c];
      const rs = cell?.mc?.rs;
      if (rs != null && rs > 1) {
        return true;
      }
    }
  }
  return false;
}

function getColumnLabel(
  ctx: Context,
  column: number,
  headerRow: number | null,
): string {
  if (headerRow != null) {
    const d = getFlowdata(ctx);
    const headerText = getDisplayedCompareValue(d!, headerRow, column);
    if (headerText.trim() !== '') {
      return headerText;
    }
  }
  return indexToColumnChar(column);
}

export function getRemoveDuplicatesPreview(
  ctx: Context,
): { preview?: RemoveDuplicatesPreview; error?: RemoveDuplicatesError } {
  if (ctx.allowEdit === false) {
    return { error: 'readOnly' };
  }
  if (!ctx.luckysheet_select_save?.length) {
    return { error: 'noSelection' };
  }
  if (ctx.luckysheet_select_save.length > 1) {
    return { error: 'noMulti' };
  }

  const baseSelection = getSelectionRange(ctx);
  if (!baseSelection) {
    return { error: 'noSelection' };
  }

  const range = expandSelectionToDataRange(ctx, baseSelection);
  const [r1, r2] = range.row;
  const [c1, c2] = range.column;

  if (rangeHasRowSpanningMerge(ctx, r1, r2, c1, c2)) {
    return { error: 'noMerge' };
  }

  const columns: RemoveDuplicatesColumnOption[] = [];
  for (let c = c1; c <= c2; c += 1) {
    columns.push({
      column: c,
      label: getColumnLabel(ctx, c, r1),
      checked: true,
    });
  }

  return {
    preview: {
      range,
      columns,
    },
  };
}

function buildRowCompareKey(
  d: NonNullable<ReturnType<typeof getFlowdata>>,
  row: number,
  analyzedColumns: number[],
): string {
  return JSON.stringify(
    analyzedColumns.map((column) =>
      getDisplayedCompareValue(d, row, column),
    ),
  );
}

function findDuplicateRows(
  ctx: Context,
  range: Selection,
  options: RemoveDuplicatesOptions,
): number[] {
  const d = getFlowdata(ctx);
  if (!d) return [];

  const [r1, r2] = range.row;
  const dataStartRow = options.hasHeaderRow ? r1 + 1 : r1;
  if (dataStartRow > r2) return [];

  const seen = new Map<string, number>();
  const duplicateRows: number[] = [];

  for (let r = dataStartRow; r <= r2; r += 1) {
    if (ctx.config?.rowhidden?.[r] != null) {
      continue;
    }
    const key = buildRowCompareKey(d, r, options.analyzedColumns);
    if (seen.has(key)) {
      duplicateRows.push(r);
    } else {
      seen.set(key, r);
    }
  }

  return duplicateRows;
}

/** Last row to scan: through last non-empty analyzed value, including empties above it. */
function getEffectiveDataEndRow(
  d: CellMatrix,
  dataStartRow: number,
  r2: number,
  analyzedColumns: number[],
): number {
  let lastWithContent = dataStartRow - 1;
  let lastWithAnyCell = dataStartRow - 1;

  for (let r = dataStartRow; r <= r2; r += 1) {
    for (const col of analyzedColumns) {
      if (d[r]?.[col] != null) {
        lastWithAnyCell = r;
      }
      if (getDisplayedCompareValue(d, r, col) !== '') {
        lastWithContent = r;
      }
    }
  }

  if (lastWithContent >= dataStartRow) return lastWithContent;
  if (lastWithAnyCell >= dataStartRow) return lastWithAnyCell;
  return dataStartRow - 1;
}

function trimRangeToDataRegion(
  d: CellMatrix,
  range: Selection,
  dataStartRow: number,
  analyzedColumns: number[],
): Selection {
  const [r1, r2] = range.row;
  const effectiveEnd = getEffectiveDataEndRow(
    d,
    dataStartRow,
    r2,
    analyzedColumns,
  );

  if (effectiveEnd < dataStartRow) {
    return { row: [r1, dataStartRow - 1], column: range.column };
  }

  return { row: [r1, effectiveEnd], column: range.column };
}

function clearCellContent(
  ctx: Context,
  d: CellMatrix,
  r: number,
  c: number,
  changeMap: Map<string, any>,
): boolean {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const hyperlinkMap = ctx.luckysheetfile[sheetIndex]?.hyperlink;
  const { dataVerification } = ctx.luckysheetfile[sheetIndex];

  const oldCellBefore =
    d[r][c] != null ? (_.cloneDeep(d[r][c]) as Cell | null) : null;

  if (dataVerification?.[`${r}_${c}`]) {
    delete dataVerification[`${r}_${c}`];
  }

  if (_.isPlainObject(d[r][c])) {
    const cell = d[r][c]!;
    delete cell.m;
    delete cell.v;
    delete cell.fc;
    delete cell.un;

    if (cell.f != null) {
      delete cell.f;
      delFunctionGroup(ctx, r, c, ctx.currentSheetId);
      delete cell.spl;
    }

    if (
      cell.ct != null &&
      (cell.ct.t === 'inlineStr' ||
        cell.ct.fa?.includes('BTC') ||
        cell.ct.fa?.includes('ETH') ||
        cell.ct.fa?.includes('SOL'))
    ) {
      delete cell.ct;
      delete cell?.baseValue;
      delete cell?.baseCurrency;
    }
    clearCellError(ctx, r, c);
  } else {
    d[r][c] = null;
  }

  if (hyperlinkMap?.[`${r}_${c}`]) {
    delete hyperlinkMap[`${r}_${c}`];
  }

  const newCellAfter = (d[r][c] as Cell | null) ?? null;
  if (!_.isEqual(oldCellBefore, newCellAfter)) {
    const key = `${r}_${c}`;
    changeMap.set(key, {
      sheetId: ctx.currentSheetId,
      path: ['celldata'],
      value: { r, c, v: newCellAfter },
      key,
      type: newCellAfter == null ? 'delete' : 'update',
    });
    return true;
  }

  return false;
}

function clearAnalyzedCellsInRows(
  ctx: Context,
  rows: number[],
  analyzedColumns: number[],
): number {
  const d = getFlowdata(ctx);
  if (!d || rows.length === 0) return 0;

  const changeMap = new Map<string, any>();
  const rowsToRecalcAutoHeight = new Set<number>();
  let clearedCount = 0;

  for (const row of rows) {
    for (const column of analyzedColumns) {
      const oldCell = d[row]?.[column];
      const prevHadWrapOrInline =
        oldCell != null &&
        ((oldCell.tb === '2' &&
          !_.isNil(oldCell.v) &&
          oldCell.v !== '') ||
          isInlineStringCell(oldCell));

      if (clearCellContent(ctx, d, row, column, changeMap)) {
        clearedCount += 1;
        if (prevHadWrapOrInline) {
          rowsToRecalcAutoHeight.add(row);
        }
      }
    }
  }

  if (changeMap.size > 0 && ctx.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(Array.from(changeMap.values()));
  }

  const canvasCtx =
    ctx.getRefs?.()?.canvas?.current?.getContext('2d') ?? null;
  if (canvasCtx && rowsToRecalcAutoHeight.size > 0) {
    for (const rowIndex of rowsToRecalcAutoHeight) {
      recalcAutoRowHeightForRow(ctx, rowIndex, d, canvasCtx);
    }
  }

  return clearedCount;
}

function columnCellHasContent(
  d: CellMatrix,
  row: number,
  column: number,
): boolean {
  return (
    cellHasDisplayValue(d[row]?.[column]) ||
    getDisplayedCompareValue(d, row, column) !== ''
  );
}

function assignCellCopy(
  ctx: Context,
  d: CellMatrix,
  row: number,
  column: number,
  cell: Cell | null,
  changeMap: Map<string, any>,
): void {
  const oldCellBefore =
    d[row]?.[column] != null ? (_.cloneDeep(d[row][column]) as Cell) : null;
  if (cell == null) {
    d[row][column] = null;
  } else {
    d[row][column] = _.cloneDeep(cell);
  }
  const newCellAfter = (d[row]?.[column] as Cell | null) ?? null;
  if (!_.isEqual(oldCellBefore, newCellAfter)) {
    const key = `${row}_${column}`;
    changeMap.set(key, {
      sheetId: ctx.currentSheetId,
      path: ['celldata'],
      value: { r: row, c: column, v: newCellAfter },
      key,
      type: newCellAfter == null ? 'delete' : 'update',
    });
  }
}

/** Shift non-empty cells up within each analyzed column only (Google column-scoped behavior). */
function compactAnalyzedColumns(
  ctx: Context,
  dataStartRow: number,
  endRow: number,
  analyzedColumns: number[],
  changeMap: Map<string, any>,
): void {
  const d = getFlowdata(ctx);
  if (!d) return;

  for (const column of analyzedColumns) {
    let writeRow = dataStartRow;
    for (let readRow = dataStartRow; readRow <= endRow; readRow += 1) {
      if (!columnCellHasContent(d, readRow, column)) continue;

      if (readRow !== writeRow) {
        const srcCell = (d[readRow]?.[column] as Cell | null) ?? null;
        assignCellCopy(ctx, d, writeRow, column, srcCell, changeMap);
        clearCellContent(ctx, d, readRow, column, changeMap);
      }
      writeRow += 1;
    }
    for (let row = writeRow; row <= endRow; row += 1) {
      if (d[row]?.[column] != null) {
        clearCellContent(ctx, d, row, column, changeMap);
      }
    }
  }
}

function applyDuplicateRemoval(
  ctx: Context,
  duplicateRows: number[],
  analyzedColumns: number[],
  dataStartRow: number,
  endRow: number,
): void {
  const d = getFlowdata(ctx);
  if (!d || duplicateRows.length === 0) return;

  const changeMap = new Map<string, any>();
  const rowsToRecalcAutoHeight = new Set<number>();

  for (const row of duplicateRows) {
    for (const column of analyzedColumns) {
      const oldCell = d[row]?.[column];
      const prevHadWrapOrInline =
        oldCell != null &&
        ((oldCell.tb === '2' &&
          !_.isNil(oldCell.v) &&
          oldCell.v !== '') ||
          isInlineStringCell(oldCell));

      if (clearCellContent(ctx, d, row, column, changeMap)) {
        if (prevHadWrapOrInline) {
          rowsToRecalcAutoHeight.add(row);
        }
      }
    }
  }

  compactAnalyzedColumns(ctx, dataStartRow, endRow, analyzedColumns, changeMap);

  if (changeMap.size > 0 && ctx.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(Array.from(changeMap.values()));
  }

  const canvasCtx =
    ctx.getRefs?.()?.canvas?.current?.getContext('2d') ?? null;
  if (canvasCtx && rowsToRecalcAutoHeight.size > 0) {
    for (const rowIndex of rowsToRecalcAutoHeight) {
      recalcAutoRowHeightForRow(ctx, rowIndex, d, canvasCtx);
    }
  }
}

export function removeDuplicates(
  ctx: Context,
  options: RemoveDuplicatesOptions,
): RemoveDuplicatesResult {
  if (ctx.allowEdit === false) {
    return { removedCount: 0, remainingCount: 0, error: 'readOnly' };
  }
  if (!ctx.luckysheet_select_save?.length) {
    return { removedCount: 0, remainingCount: 0, error: 'noSelection' };
  }
  if (ctx.luckysheet_select_save.length > 1) {
    return { removedCount: 0, remainingCount: 0, error: 'noMulti' };
  }
  if (!options.analyzedColumns.length) {
    return { removedCount: 0, remainingCount: 0, error: 'noColumns' };
  }

  const baseSelection = options.range ?? getSelectionRange(ctx);
  if (!baseSelection) {
    return { removedCount: 0, remainingCount: 0, error: 'noSelection' };
  }

  const expandedRange =
    options.range ?? expandSelectionToDataRange(ctx, baseSelection);

  const d = getFlowdata(ctx);
  if (!d) {
    return { removedCount: 0, remainingCount: 0, error: 'noSelection' };
  }

  const [expandedR1] = expandedRange.row;
  const dataStartRow = options.hasHeaderRow ? expandedR1 + 1 : expandedR1;

  const range = trimRangeToDataRegion(
    d,
    expandedRange,
    dataStartRow,
    options.analyzedColumns,
  );
  const [r1, r2] = range.row;

  if (dataStartRow > r2) {
    return { removedCount: 0, remainingCount: 0 };
  }

  const analyzedC1 = Math.min(...options.analyzedColumns);
  const analyzedC2 = Math.max(...options.analyzedColumns);
  if (rangeHasRowSpanningMerge(ctx, r1, r2, analyzedC1, analyzedC2)) {
    return { removedCount: 0, remainingCount: 0, error: 'noMerge' };
  }

  const duplicateRows = findDuplicateRows(ctx, range, options);
  const comparableRowCount = _.range(dataStartRow, r2 + 1).filter(
    (row) => ctx.config?.rowhidden?.[row] == null,
  ).length;

  if (
    comparableRowCount > 0 &&
    duplicateRows.length >= comparableRowCount
  ) {
    return { removedCount: 0, remainingCount: 0, error: 'cannotDeleteAllRow' };
  }

  if (duplicateRows.length > 0) {
    applyDuplicateRemoval(
      ctx,
      duplicateRows,
      options.analyzedColumns,
      dataStartRow,
      r2,
    );
    jfrefreshgrid(ctx, null, undefined);
  }

  const removedCount = duplicateRows.length;
  const remainingCount = Math.max(comparableRowCount - duplicateRows.length, 0);

  return {
    removedCount,
    remainingCount,
  };
}

export function getRemoveDuplicatesErrorMessage(
  ctx: Context,
  error: RemoveDuplicatesError,
): string {
  const {
    matrixCalculation,
    screenshot,
    rightclick,
    removeDuplicates: removeDuplicatesLocale,
  } = locale(ctx) as any;

  switch (error) {
    case 'noMulti':
      return (
        removeDuplicatesLocale?.noMulti ||
        matrixCalculation?.noMulti ||
        screenshot?.screenshotTipHasMulti ||
        'Cannot perform this operation on multiple selection areas, please select a single area'
      );
    case 'noMerge':
      return (
        removeDuplicatesLocale?.noMerge ||
        screenshot?.screenshotTipHasMerge ||
        'This operation cannot be performed on merged cells'
      );
    case 'cannotDeleteAllRow':
      return rightclick?.cannotDeleteAllRow || 'Cannot delete all rows';
    case 'noColumns':
      return (
        removeDuplicatesLocale?.noColumns ||
        'Select at least one column to analyze'
      );
    case 'readOnly':
      return (
        removeDuplicatesLocale?.readOnly ||
        'Cannot remove duplicates in read-only mode'
      );
    case 'noSelection':
    default:
      return (
        removeDuplicatesLocale?.noSelection ||
        screenshot?.screenshotTipNoSelection ||
        'Please select the scope of the operation'
      );
  }
}
