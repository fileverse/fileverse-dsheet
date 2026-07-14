/** Cell / formula key format used in depsByCell and revDepsByCell. */
export function toFormulaDepCellKey(
  sheetId: string,
  r: number,
  c: number,
): string {
  return `${sheetId}:${r}:${c}`;
}

/**
 * Walk revDepsByCell from a changed cell to collect every formula cell that
 * must recalculate (direct + transitive dependents).
 */
export function collectTransitiveFormulaDependents(
  originCellKey: string,
  revDepsByCell: Map<string, Set<string>>,
): Set<string> {
  const formulaKeys = new Set<string>();
  const queue: string[] = [originCellKey];
  const visitedCells = new Set<string>([originCellKey]);

  while (queue.length > 0) {
    const cellKey = queue.shift()!;
    const dependents = revDepsByCell.get(cellKey);
    if (!dependents) continue;

    dependents.forEach((formulaKey) => {
      if (formulaKeys.has(formulaKey)) return;
      formulaKeys.add(formulaKey);
      if (!visitedCells.has(formulaKey)) {
        visitedCells.add(formulaKey);
        queue.push(formulaKey);
      }
    });
  }

  return formulaKeys;
}
