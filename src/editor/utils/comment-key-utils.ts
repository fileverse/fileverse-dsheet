import { CellPosition } from '../types/comments';

export const parseCellKey = (key: string): CellPosition | null => {
  if (key.includes('WITHOUT')) return null;
  const parts = key.split('_');
  if (parts.length === 3) {
    const [sheetIdStr, rowStr, colStr] = parts;
    const row = Number(rowStr);
    const col = Number(colStr);
    if (!isNaN(row) && !isNaN(col)) return { row, col, sheetId: sheetIdStr };
  }
  if (parts.length === 2) {
    const [rowStr, colStr] = parts;
    const row = Number(rowStr);
    const col = Number(colStr);
    if (!isNaN(row) && !isNaN(col)) return { row, col, sheetId: '0' };
  }
  return null;
};

export const generateWithoutCellKey = (dataLength: number): string =>
  `WITHOUT_CELL_${dataLength}`;

export const isCellComment = (key: string): boolean => !key.includes('WITHOUT');

export const getCellReference = (row: number, col: number): string => {
  let colLetter = '';
  let colNum = col;
  while (colNum >= 0) {
    colLetter = String.fromCharCode(65 + (colNum % 26)) + colLetter;
    colNum = Math.floor(colNum / 26) - 1;
    if (colNum < 0) break;
  }
  return `${colLetter}${row + 1}`;
};

export const formatCommentDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const day = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
  return `${time} • ${day}`;
};
