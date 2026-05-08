export function columnLabelIndex(label: string): number {
  let index = 0;
  const A = "A".charCodeAt(0);

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < label.length; i++) {
    const charCode = label.charCodeAt(i) - A + 1;
    index = index * 26 + charCode;
  }

  return index - 1;
}

export function indexToColumnLabel(index: number): string {
  let label = "";
  while (index >= 0) {
    const remainder = index % 26;
    label = String.fromCharCode(65 + remainder) + label;
    index = Math.floor(index / 26) - 1;
  }
  return label;
}

export class FormularCellRefError extends Error {
  formula: string;

  constructor(message: string, formula: string) {
    super(message);
    this.name = "FormularCellRefError";
    this.formula = formula;
  }
}

export function adjustFormulaForPaste(
  formula: string,
  srcCol: number,
  srcRow: number,
  destCol: number,
  destRow: number
) {
  const colOffset = destCol - srcCol;
  const rowOffset = destRow - srcRow;

  // Track whether we created any invalid references
  let hadInvalid = false;

  // Parse one full A1 token (including optional $ on col/row).
  // Do not use `\b...` here: with `$A$1`, word-boundary matching can start at
  // `A$1` and accidentally drop the leading column `$`.
  const cellRefRegex = /^(\$?)([A-Z]+)(\$?)(\d+)$/;
  // Match quoted strings or cell refs (A1, $A1, A$1, $A$1). Avoid matching sheet names (e.g. Sheet1 in "Sheet1!A1") by requiring ref not to be followed by "!"
  const stringOrCellRef = /"(?:\\.|[^"])*"|(\$?[A-Z]+\$?\d+)(?!\s*!)\b/g;

  const result = formula.replace(
    stringOrCellRef,
    (m: string, cellRef: string) => {
      // m = whole matched token
      // cellRef = only group 1 when it's a cell reference (undefined for quoted strings)

      if (!cellRef) return m; // Inside quotes → DO NOT modify

      // Now process your cell reference normally:
      const match = cellRef.match(cellRefRegex);
      if (!match) return cellRef;
      const [, absCol, colLetters, absRow, rowNum] = match;
      let colIndex = columnLabelIndex(colLetters);
      let rowIndex = parseInt(rowNum, 10);

      if (!absCol) colIndex += colOffset;
      if (!absRow) rowIndex += rowOffset;

      // Build either a normal or visibly invalid reference
      if (colIndex < 0 || rowIndex <= 0) {
        hadInvalid = true;
        const invalidCol =
          colIndex < 0
            ? `${absCol ? "$" : ""}${colLetters}${colIndex}`
            : `${absCol ? "$" : ""}${indexToColumnLabel(colIndex)}`;
        const invalidRow = rowIndex.toString();
        return `${invalidCol}${invalidRow}`;
      }

      const newCol = indexToColumnLabel(colIndex);
      return `${absCol ? "$" : ""}${newCol}${absRow ? "$" : ""}${rowIndex}`;
    }
  );

  // if any invalid references were generated, throw error with full visible formula
  if (hadInvalid) {
    const brokenFormula = `=${result.replace(/^=/, "")}`;
    throw new FormularCellRefError(
      `Invalid cell reference generated while pasting formula: ${formula}`,
      brokenFormula
    );
  }

  return result;
}
