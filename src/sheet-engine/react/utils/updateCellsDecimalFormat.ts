import { getFlowdata } from '@sheet-engine/core';
import { FIAT_ICON_MAP } from '../constants';

// Helper to get the actual symbol for a fiat code
function getFiatSymbol(code: string): string {
  switch (code) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    case 'CNY':
      return '¥';
    case 'INR':
      return '₹';
    default:
      return code;
  }
}

export function updateCellsDecimalFormat({
  context,
  setContext,
  decimals,
  denomination, // optional, for fiat
}: {
  context: any;
  setContext: (fn: (ctx: any) => void) => void;
  decimals: number;
  denomination?: string;
}) {
  const selections = context.luckysheet_select_save;
  const flowdata = getFlowdata(context);
  if (!selections || !flowdata) return;

  // Expand all selected cells
  const selectedCells: { row: number; col: number }[] = [];
  selections.forEach((selection: any) => {
    for (let row = selection.row[0]; row <= selection.row[1]; row += 1) {
      for (
        let col = selection.column[0];
        col <= selection.column[1];
        col += 1
      ) {
        selectedCells.push({ row, col });
      }
    }
  });

  setContext((ctx: any) => {
    const d = getFlowdata(ctx);
    if (!d) return;
    selectedCells.forEach(({ row, col }) => {
      const cell = d[row]?.[col];
      if (!cell) return;
      let denomStr = 'ETH';
      let isCrypto = false;
      if (cell.ct && typeof cell.ct.fa === 'string') {
        const [, matchedDenom] = cell.ct.fa.match(/"([A-Z]+)"/) || [];
        if (matchedDenom) {
          denomStr = matchedDenom;
          isCrypto = true;
        }
      }
      if (isCrypto) {
        cell.ct = {
          fa: `0.${'0'.repeat(decimals)} "${denomStr}"`,
          t: 'n',
        };
        if (typeof cell.v === 'number') {
          cell.m = `${cell.v.toFixed(decimals)} ${denomStr}`;
        }
      } else {
        const fiat = denomination || 'USD';
        // Use the correct symbol from FIAT_ICON_MAP, fallback to code
        const symbol = fiat in FIAT_ICON_MAP ? getFiatSymbol(fiat) : fiat;
        cell.ct = {
          fa: `${symbol} #,##0.${'0'.repeat(decimals)}`,
          t: 'n',
        };
        if (typeof cell.v === 'number') {
          cell.m = `${symbol} ${cell.v.toFixed(decimals)}`;
        }
      }
    });
  });
}
