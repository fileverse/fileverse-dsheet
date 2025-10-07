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
  sourceIndex: number,
  targetIndex: number
): FormulaCells {
  const updatedData: FormulaCells = {};

  for (const key in data) {
    const cell = data[key];
    const updatedCell: FormulaCell = {
      ...cell,
      row: updateSingleRow(cell.row, sourceIndex, targetIndex),
      rowRefrenced: cell.rowRefrenced.map(r =>
        updateSingleRow(r, sourceIndex, targetIndex)
      )
    };

    // Update the key if the row has changed
    const newKey = `${updatedCell.row}_${updatedCell.column}`;
    updatedData[newKey] = updatedCell;
  }

  return updatedData;
}

function updateSingleRow(
  row: number,
  sourceIndex: number,
  targetIndex: number
): number {
  if (row === sourceIndex) {
    // Moving down (sourceIndex < targetIndex): row becomes targetIndex
    // Moving up (sourceIndex > targetIndex): row becomes targetIndex
    if (sourceIndex < targetIndex) {
      return row + 1;
    } else if (sourceIndex > targetIndex) {
      return row - 1;
    }
  } else if (row > sourceIndex && row <= targetIndex) {
    // Rows between source and target (when moving down) shift up by 1
    return row - 1;
  } else if (row < sourceIndex && row >= targetIndex) {
    // Rows between target and source (when moving up) shift down by 1
    return row + 1;
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
  sourceIndex: number,
  targetIndex: number
): FormulaCells {
  const updatedData: FormulaCells = {};

  for (const key in data) {
    const cell = data[key];
    const updatedCell: FormulaCell = {
      ...cell,
      column: updateSingleColumn(cell.column, sourceIndex, targetIndex),
      columnRefrenced: cell.columnRefrenced.map(c =>
        updateSingleColumn(c, sourceIndex, targetIndex)
      )
    };

    // Update the key if the column has changed
    const newKey = `${updatedCell.row}_${updatedCell.column}`;
    updatedData[newKey] = updatedCell;
  }

  return updatedData;
}

function updateSingleColumn(
  column: number,
  sourceIndex: number,
  targetIndex: number
): number {
  if (column === sourceIndex) {
    return targetIndex;
  } else if (column > sourceIndex && column < targetIndex) {
    return column - 1;
  } else if (column < sourceIndex && column >= targetIndex) {
    return column + 1;
  }
  return column;
}

