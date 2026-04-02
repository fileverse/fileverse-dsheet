import {
  Context,
  getSheetIndex,
  getRangetxt,
  indexToColumnChar,
} from "@sheet-engine/core";

/**
 * Find all cells that have matching validation rules
 * Compares all relevant validation properties except rangeTxt and checked
 */
export function findMatchingCells(
  ctx: Context,
  currentRow: number,
  currentCol: number
): { row: number; col: number }[] {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId) as number;
  const dataVerification =
    ctx.luckysheetfile[sheetIndex].dataVerification ?? {};

  const currentValidation = dataVerification[`${currentRow}_${currentCol}`];
  if (!currentValidation) return [];

  const matchingCells: { row: number; col: number }[] = [];

  // Compare all cells with validation
  Object.keys(dataVerification).forEach((key) => {
    const [r, c] = key.split("_").map(Number);
    const validation = dataVerification[key];

    // Compare relevant fields (exclude rangeTxt and checked)
    if (
      validation.type === currentValidation.type &&
      validation.type2 === currentValidation.type2 &&
      validation.value1 === currentValidation.value1 &&
      validation.value2 === currentValidation.value2 &&
      validation.color === currentValidation.color &&
      validation.validity === currentValidation.validity &&
      validation.remote === currentValidation.remote &&
      validation.prohibitInput === currentValidation.prohibitInput &&
      validation.hintShow === currentValidation.hintShow &&
      validation.hintValue === currentValidation.hintValue
    ) {
      matchingCells.push({ row: r, col: c });
    }
  });

  return matchingCells;
}

/**
 * Convert a list of cell coordinates to a range string (e.g., "A1:A5" or "A1,A3,A5")
 * Tries to merge contiguous cells into ranges where possible
 */
export function cellsToRangeString(
  ctx: Context,
  cells: { row: number; col: number }[]
): string {
  if (cells.length === 0) return "";
  if (cells.length === 1) {
    return indexToColumnChar(cells[0].col) + (cells[0].row + 1);
  }

  // Sort cells by row, then column
  const sorted = [...cells].sort((a, b) =>
    a.row === b.row ? a.col - b.col : a.row - b.row
  );

  // Try to merge into contiguous ranges
  const ranges: string[] = [];
  let startRow = sorted[0].row;
  let endRow = sorted[0].row;
  let startCol = sorted[0].col;
  let endCol = sorted[0].col;

  for (let i = 1; i < sorted.length; i += 1) {
    const { row, col } = sorted[i];

    // Check if cell extends current range
    if (col === startCol && col === endCol && row === endRow + 1) {
      // Extends vertically in same column
      endRow = row;
    } else if (row === startRow && row === endRow && col === endCol + 1) {
      // Extends horizontally in same row
      endCol = col;
    } else {
      // New range needed
      const range = getRangetxt(ctx, ctx.currentSheetId, {
        row: [startRow, endRow],
        column: [startCol, endCol],
      });
      ranges.push(range);
      startRow = row;
      endRow = row;
      startCol = col;
      endCol = col;
    }
  }

  // Add last range
  const range = getRangetxt(ctx, ctx.currentSheetId, {
    row: [startRow, endRow],
    column: [startCol, endCol],
  });
  ranges.push(range);

  return ranges.join(",");
}
