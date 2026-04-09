/**
 * Keys that end the current formula range-reference segment (same UX as typing "," between
 * function args): clear the blue range overlay and return sheet selection to the anchor cell.
 */
const FORMULA_SEGMENT_BOUNDARY_KEYS = new Set<string>([
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '&',
  // Comparisons (e.g. =A1>B1); <> starts with "<"
  '>',
  '<',
  // After a closed paren, next token may be a new ref (e.g. =SUM(A1)+B1)
  ')',
]);

export function isFormulaSegmentBoundaryKey(key: string): boolean {
  return FORMULA_SEGMENT_BOUNDARY_KEYS.has(key);
}
