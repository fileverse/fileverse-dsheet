// @ts-ignore
import { Parser, ERROR_REF } from '@sheet-engine/formula-parser';
import type { Cell, CellMatrix } from '../types';
import { isNumericCellType } from './validation';

export type SnapshotSheet = {
  id: string;
  name: string;
  data: CellMatrix | null | undefined;
};

export type SnapshotFormulaCell = {
  r: number;
  c: number;
  id: string;
  calc_funcStr: string;
};

export type SnapshotFormulaResult = {
  r: number;
  c: number;
  id: string;
  v: unknown;
  f: string;
  spe?: unknown;
  deps: string[];
  isError: boolean;
};

export type SnapshotEvalInput = {
  sheets: SnapshotSheet[];
  execFunctionGlobalData: Record<string, { v: unknown; f: unknown }>;
  formulas: SnapshotFormulaCell[];
};

export type SnapshotEvalOutput = {
  execFunctionGlobalData: Record<string, { v: unknown; f: unknown }>;
  results: SnapshotFormulaResult[];
};

function tryGetCellAsNumber(cell: Cell | null | undefined) {
  const rawV = cell?.v;
  const normalizedV =
    typeof rawV === 'string' ? rawV.trim().replace(/,/g, '') : rawV;
  const isLongIntegerString =
    typeof normalizedV === 'string' && /^-?\d{16,}$/.test(normalizedV);
  const isDecimalString =
    typeof normalizedV === 'string' && /^-?\d+\.\d+$/.test(normalizedV);
  if (isLongIntegerString) {
    return normalizedV;
  }
  if (isDecimalString) {
    return Number(normalizedV);
  }
  const isCryptoDeno =
    typeof cell?.m === 'string'
      ? cell.m.includes('ETH') ||
        cell.m.includes('SOL') ||
        cell.m.includes('BTC')
      : false;
  if (isCryptoDeno && typeof cell?.m === 'string') {
    return Number(cell.m.split(' ')[0]);
  }
  if (isNumericCellType(cell) && !String(cell?.m).includes('%')) {
    const n = Number(cell?.v);
    return Number.isNaN(n) ? cell?.v : n;
  }
  return String(cell?.m).includes('%') ? cell?.m : cell?.v;
}

function getSheetIdByName(
  sheetsByName: Map<string, string>,
  name: string,
): string | null {
  return sheetsByName.get(name) ?? null;
}

/** Worker-safe formula evaluation against plain sheet snapshots (no React/immer). */
export function evalFormulasInSnapshot(
  input: SnapshotEvalInput,
): SnapshotEvalOutput {
  const dataBySheetId = new Map<string, CellMatrix | null | undefined>();
  const sheetsByName = new Map<string, string>();
  for (const sheet of input.sheets) {
    dataBySheetId.set(sheet.id, sheet.data);
    if (sheet.name) {
      sheetsByName.set(sheet.name, sheet.id);
    }
  }

  const globalData = { ...input.execFunctionGlobalData };
  const parser: any = new Parser();
  let activeDeps: Set<string> | null = null;

  const toCellKey = (sheetId: string, r: number, c: number) =>
    `${sheetId}:${r}:${c}`;
  const recordDep = (key: string) => {
    activeDeps?.add(key);
  };

  parser.on('callCellValue', (cellCoord: any, options: any, done: any) => {
    const sheetId =
      cellCoord.sheetName == null
        ? options.sheetId
        : getSheetIdByName(sheetsByName, cellCoord.sheetName);
    if (sheetId == null) throw Error(ERROR_REF);
    recordDep(toCellKey(sheetId, cellCoord.row.index, cellCoord.column.index));
    const flowdata = dataBySheetId.get(sheetId);
    const cacheKey = `${cellCoord.row.index}_${cellCoord.column.index}_${sheetId}`;
    const cell =
      globalData[cacheKey] || flowdata?.[cellCoord.row.index]?.[cellCoord.column.index];
    done(tryGetCellAsNumber(cell as Cell));
  });

  parser.on(
    'callRangeValue',
    (startCellCoord: any, endCellCoord: any, options: any, done: any) => {
      const sheetId =
        startCellCoord.sheetName == null
          ? options.sheetId
          : getSheetIdByName(sheetsByName, startCellCoord.sheetName);
      if (sheetId == null) throw Error(ERROR_REF);
      const flowdata = dataBySheetId.get(sheetId);
      let startRow = startCellCoord.row.index;
      let endRow = endCellCoord.row.index;
      let startCol = startCellCoord.column.index;
      let endCol = endCellCoord.column.index;
      const emptyRow = startRow === -1 || endRow === -1;
      const emptyCol = startCol === -1 || endCol === -1;
      if (emptyRow) {
        startRow = 0;
        endRow = flowdata?.length ?? 0;
      }
      if (emptyCol) {
        startCol = 0;
        endCol = flowdata?.[0]?.length ?? 0;
      }
      if (emptyRow && emptyCol) throw Error(ERROR_REF);

      const fragment: unknown[][] = [];
      let cryptoDenomination = '';
      let cryptoDecimal = 0;

      for (let row = startRow; row <= endRow; row += 1) {
        const colFragment: unknown[] = [];
        for (let col = startCol; col <= endCol; col += 1) {
          if (
            typeof options === 'object' &&
            row === options.row &&
            col === options.column
          ) {
            continue;
          }
          recordDep(toCellKey(sheetId, row, col));
          const cell =
            globalData[`${row}_${col}_${sheetId}`] || flowdata?.[row]?.[col];
          const v = tryGetCellAsNumber(cell as Cell);
          const cellM = (cell as Cell)?.m;
          if (
            typeof cellM === 'string' &&
            (cellM.includes('ETH') ||
              cellM.includes('SOL') ||
              cellM.includes('BTC')) &&
            cryptoDenomination !== 'Error'
          ) {
            const visualString = cellM.split(' ');
            if (
              cryptoDenomination !== '' &&
              cryptoDenomination !== visualString[1]
            ) {
              cryptoDenomination = 'Error';
            } else {
              cryptoDenomination = visualString[1];
            }
            cryptoDecimal = visualString[0].includes('.')
              ? visualString[0].split('.')[1]?.length
              : 0;
          }
          colFragment.push(v);
        }
        fragment.push(colFragment);
      }

      if (cryptoDenomination === 'Error') {
        cryptoDenomination = '';
        cryptoDecimal = 0;
      }
      done(fragment, cryptoDenomination, cryptoDecimal);
    },
  );

  const results: SnapshotFormulaResult[] = [];

  for (const formula of input.formulas) {
    const originKey = `${formula.id}:${formula.r}:${formula.c}`;
    activeDeps = new Set<string>();
    const expression = formula.calc_funcStr.startsWith('=')
      ? formula.calc_funcStr.slice(1)
      : formula.calc_funcStr;

    let parsedResponse: { error: unknown; result: unknown };
    try {
      parsedResponse = parser.parse(expression, {
        sheetId: formula.id,
        row: formula.r,
        column: formula.c,
      });
    } catch {
      parsedResponse = { error: '#ERROR', result: '#ERROR' };
    }
    const deps = Array.from(activeDeps);
    activeDeps = null;

    const isError = parsedResponse.error != null;
    const outputValue = isError ? parsedResponse.error : parsedResponse.result;
    const f = formula.calc_funcStr;

    globalData[`${formula.r}_${formula.c}_${formula.id}`] = {
      v: outputValue,
      f,
    };

    results.push({
      r: formula.r,
      c: formula.c,
      id: formula.id,
      v: outputValue,
      f,
      deps,
      isError,
    });
  }

  return { execFunctionGlobalData: globalData, results };
}
