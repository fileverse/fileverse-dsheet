/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Cell, WorkbookInstance } from '@fileverse-dev/fortune-react';
import { isNumericOnly, isHexValue } from './generic';
import { update } from '@fileverse-dev/fortune-core';

export type FormulaSyncType = {
  row: number;
  column: number;
  newValue: Record<string, string>;
  apiData: Array<Record<string, object>> | Array<Array<string>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
};

export function isUsdValue(str: string) {
  if (typeof str !== 'string') return false;

  const allowed = ['price', 'fully_diluted_value'];
  return allowed.includes(str) || str.toLowerCase().includes('usd');
}
export const USD_FA = `$#,##0.${'0'.repeat(2)}`;

export const formulaResponseUiSync = ({
  row,
  column,
  newValue,
  apiData,
  sheetEditorRef,
}: FormulaSyncType): void => {
  const headers: string[] = Array.isArray(apiData[0])
    ? apiData[0]
    : Object.keys(apiData[0]);

  // handle row/col bounds and add new rows/cols
  const sheet = sheetEditorRef.current?.getSheet();
  const currentTotalRow = sheet?.data?.length || 0;
  const currentTotalColumn = sheet?.data?.[0]?.length || 0;
  const extraRow = apiData.length - (currentTotalRow - row) + 1;
  const extraCol = headers.length - (currentTotalColumn - column) + 1;

  if (extraRow > 0) {
    sheetEditorRef.current?.insertRowOrColumn(
      'row',
      currentTotalRow - 1,
      extraRow,
    );
  }
  if (extraCol > 0) {
    sheetEditorRef.current?.insertRowOrColumn(
      'column',
      currentTotalColumn - 1,
      extraCol,
    );
  }

  let range;
  const data = [];

  if (!Array.isArray(apiData[0])) {
    range = {
      row: [row, row + apiData.length],
      column: [column, column + (headers.length - 1)],
    };

    const headerRow = headers.map((headerInfo, index) => {
      if (index === 0) {
        const cloneCellData =
          newValue && typeof newValue === 'object'
            ? cloneCellStyles({ ...newValue })
            : newValue;
        return {
          ...cloneCellData,
          m: headerInfo,
          v: headerInfo,
          isDataBlockFormula: true,
        };
      }
      const existingHeader = getCellClone(row, column + index, sheetEditorRef);
      const { m, ct, ...existingHeaderData } = existingHeader || {};
      const ctHeader = buildCellFormat(headerInfo, existingHeader?.ct);
      return {
        ...existingHeaderData,
        v: headerInfo,
        m: String(headerInfo),
        ...(ctHeader ? { ct: ctHeader } : {}),
      };
    });
    data.push(headerRow);

    // Data rows
    for (let i = 0; i < apiData.length; i++) {
      const tempData: Cell[] = [];
      headers.forEach((header: string, j: number) => {
        // @ts-expect-error later
        const cellValue = apiData[i][header];
        const existing = getCellClone(row + 1 + i, column + j, sheetEditorRef);
        const { m: _dropM, ct: _dropCt, ...existingData } = existing || {};
        const isNum = isNumValue(cellValue);

        const extraProperties = {} as any;

        if (isNum && isUsdValue(header)) {
          extraProperties.m = update(USD_FA, cellValue);
          extraProperties.ht = 2;
        } else if (cellValue) {
          extraProperties.m = String(cellValue);
        }

        tempData.push({
          ...existingData,
          ...preserveTextColorFromInlineStyle(existing, isNum), // move color from styles to cell-level 'fc' when becoming numeric
          v: cellValue,
          ct: buildCellFormat(cellValue, existing.ct, header),
          ...extraProperties,
        });
      });
      data.push(tempData);
    }
  } else if (Array.isArray(apiData[0])) {
    range = {
      row: [row, row + apiData.length - 1],
      column: [column, column + (apiData[0].length - 1)],
    };

    const headerVals = (apiData[0] as any[]).map(String);
    const headerRow = headerVals.map((headerInfo, index) => {
      if (index === 0) {
        const cloneCellData =
          newValue && typeof newValue === 'object'
            ? cloneCellStyles({ ...newValue })
            : newValue;
        return {
          ...cloneCellData,
          m: headerInfo,
          v: headerInfo,
          isDataBlockFormula: true,
        };
      }
      const existingHeader = getCellClone(row, column + index, sheetEditorRef);
      const { m, ct, ...existingHeaderData } = existingHeader || {};
      const ctHeader = buildCellFormat(headerInfo, existingHeader?.ct);
      return {
        ...existingHeaderData,
        v: headerInfo,
        m: String(headerInfo),
        ...(ctHeader ? { ct: ctHeader } : {}),
      };
    });
    data.push(headerRow);

    // Data rows
    for (let i = 1; i < apiData.length; i++) {
      const tempData: Cell[] = [];
      (apiData[i] as any[]).forEach((cellValue: any, j: number) => {
        const existing = getCellClone(row + i, column + j, sheetEditorRef);
        const { m, ct, ...existingData } = existing || {};
        const isNum = isNumValue(cellValue);

        tempData.push({
          ...existingData,
          ...preserveTextColorFromInlineStyle(existing, isNum), // move color from styles to cell-level 'fc' when becoming numeric
          v: cellValue,
          ct: buildCellFormat(cellValue, existing.ct),
          // if the value is numeric, skip "m" (FortuneSheet will render display text using v + ct/fa).
          // if it's text, explicitly set "m" to match the value so it displays correctly.
          ...(isNum ? {} : { m: cellValue ? String(cellValue) : '' }),
        });
      });
      data.push(tempData);
    }
  }
  if (range) {
    sheetEditorRef.current?.setCellValuesByRange(data, range);
  }
};

export const getCellClone = (
  r: number,
  c: number,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
) => {
  const cellMatrix = sheetEditorRef.current?.getSheet()?.data;
  const cell = cellMatrix?.[r]?.[c];
  if (cell == null) return {};
  return typeof cell === 'object' ? { ...cell } : { v: cell };
};

export const isNumValue = (v: any) => isNumericOnly(v) && !isHexValue(v);

export const cloneInlineStyles = (styles: any) =>
  Array.isArray(styles) ? styles.map((style) => ({ ...style })) : styles;

export const buildCellFormat = (
  value: any,
  existingCt: Cell['ct'],
  header?: string,
) => {
  const isNum = isNumValue(value);
  if (header && isNum && isUsdValue(header)) {
    const { s: _dropS, ...restCt } = existingCt || {};
    return { ...restCt, t: 'n', fa: USD_FA, ht: 2 };
  }
  if (!existingCt) {
    return isNum ? { t: 'n', fa: 'General' } : { t: 's', fa: '@' };
  }
  if (!isNum) {
    const fa = existingCt.t === 's' && existingCt.fa ? existingCt.fa : '@';
    return { ...existingCt, t: 's', fa, s: cloneInlineStyles(existingCt.s) };
  }
  // drop inline styles for numeric values to avoid internal  mutations (fs/tb) errors
  const fa = existingCt.t === 'n' && existingCt.fa ? existingCt.fa : 'General';
  const { s: _dropS, ...restCt } = existingCt || ({} as any);
  return { ...restCt, t: 'n', fa };
};

export const preserveTextColorFromInlineStyle = (
  existing: any,
  nextIsNum: boolean,
) => {
  if (!nextIsNum) return {};
  const runs = existing?.ct?.s;
  if (!Array.isArray(runs) || runs.length === 0) return {};
  const fc = runs[0]?.fc;
  return fc && !existing?.fc ? { fc } : {};
};

export const cloneCellStyles = (cell: Cell) => {
  // if it has inline styles, clone them
  if (!cell || typeof cell !== 'object') return cell ?? {};
  const ct = cell.ct;
  if (!ct || !Array.isArray(ct.s)) return { ...cell };
  return { ...cell, ct: { ...ct, s: cloneInlineStyles(ct.s) } };
};
