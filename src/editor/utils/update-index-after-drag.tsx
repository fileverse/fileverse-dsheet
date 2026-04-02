interface FormulaCell {
  formulaName: string;
  row: number;
  column: number;
  rowRefrenced: number[];
  columnRefrenced: number[];
}

interface FormulaCells {
  [key: string]: FormulaCell;
}

export function updateRowIndices(
  data: FormulaCells,
  selectedSourceIndex: number[],
  selectedTargetIndex: number[],
  sourceIndex: number,
  targetIndex: number,
): FormulaCells {
  const updatedData: FormulaCells = {};

  for (const key in data) {
    const cell = data[key];
    const updatedCell: FormulaCell = {
      ...cell,
      row: updateSingleRow(
        cell.row,
        selectedSourceIndex,
        selectedTargetIndex,
        sourceIndex,
        targetIndex,
      ),
      rowRefrenced: cell.rowRefrenced.map((r) =>
        updateSingleRow(
          r,
          selectedSourceIndex,
          selectedTargetIndex,
          sourceIndex,
          targetIndex,
        ),
      ),
    };

    // Update the key if the row has changed
    const newKey = `${updatedCell.row}_${updatedCell.column}`;
    updatedData[newKey] = updatedCell;
  }

  return updatedData;
}

function updateSingleRow(
  row: number,
  selectedSourceIndex: number[],
  selectedTargetIndex: number[],
  sourceIndex: number,
  targetIndex: number,
): number {
  if (Array.isArray(selectedSourceIndex) && selectedSourceIndex.includes(row)) {
    const index = selectedSourceIndex.indexOf(row);
    // The dragged row always moves to targetIndex
    return selectedTargetIndex[index]; // ✓ FIXED: Should be targetIndex, not row +/- 1
  } else if (row > sourceIndex && row <= targetIndex) {
    // Rows between source and target (when moving down) shift up by 1
    return row - selectedSourceIndex.length;
  } else if (row < sourceIndex && row >= targetIndex) {
    // Rows between target and source (when moving up) shift down by 1
    return row + selectedSourceIndex.length;
  }
  return row;
}

interface FormulaCell {
  formulaName: string;
  row: number;
  column: number;
  rowRefrenced: number[];
  columnRefrenced: number[];
}

export function updateColumnIndices(
  data: FormulaCells,
  selectedSourceIndex: number[],
  selectedTargetIndex: number[],
  sourceIndex: number,
  targetIndex: number,
): FormulaCells {
  const updatedData: FormulaCells = {};

  for (const key in data) {
    const cell = data[key];
    const updatedCell: FormulaCell = {
      ...cell,
      column: updateSingleColumn(
        cell.column,
        selectedSourceIndex,
        selectedTargetIndex,
        sourceIndex,
        targetIndex,
      ),
      columnRefrenced: cell.columnRefrenced.map((c) =>
        updateSingleColumn(
          c,
          selectedSourceIndex,
          selectedTargetIndex,
          sourceIndex,
          targetIndex,
        ),
      ),
    };

    // Update the key if the column has changed
    const newKey = `${updatedCell.row}_${updatedCell.column}`;
    updatedData[newKey] = updatedCell;
  }

  return updatedData;
}

function updateSingleColumn(
  column: number,
  selectedSourceIndex: number[],
  selectedTargetIndex: number[],
  sourceIndex: number,
  targetIndex: number,
): number {
  if (
    Array.isArray(selectedSourceIndex) &&
    selectedSourceIndex.includes(column)
  ) {
    const index = selectedSourceIndex.indexOf(column);
    return selectedTargetIndex[index];
  } else if (column > sourceIndex && column < targetIndex) {
    return column - 1;
  } else if (column < sourceIndex && column >= targetIndex) {
    return column + 1;
  }
  return column;
}
