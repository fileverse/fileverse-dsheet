import { Sheet } from '@fileverse-dev/fortune-core';
/**
 * Compare two spreadsheets' cell data and check if anything changed
 * @param {Array} oldSheets - Original sheets data
 * @param {Array} newSheets - New sheets data
 * @returns {boolean} - true if any cell data changed, false if identical
 */
export function isSpreadsheetChanged(oldSheets: Sheet[], newSheets: Sheet[]) {
  if (!oldSheets || !newSheets || oldSheets.length !== newSheets.length) {
    return true;
  }

  if (oldSheets.length > 0) {
    for (let i = 0; i < oldSheets.length; i++) {
      const oldSheet = oldSheets[i];
      const newSheet = newSheets[i];

      if (JSON.stringify(oldSheet.config) !== JSON.stringify(newSheet.config)) {
        return true;
      }

      const oldCellData = oldSheet?.celldata || [];
      const newCellData = newSheet?.celldata || [];

      const oldCellMap = new Map();
      const newCellMap = new Map();

      // Only store cells with non-null values
      for (const cell of oldCellData) {
        if (cell.v !== null) {
          const key = `${cell.r},${cell.c}`;
          oldCellMap.set(key, cell.v);
        }
      }

      for (const cell of newCellData) {
        if (cell.v !== null) {
          const key = `${cell.r},${cell.c}`;
          newCellMap.set(key, cell.v);
        }
      }

      // Different number of non-null cells means change
      if (oldCellMap.size !== newCellMap.size) {
        return true;
      }

      // Check each non-null cell specifically
      for (const [key, value] of oldCellMap.entries()) {
        if (!newCellMap.has(key)) {
          return true;
        }

        const newValue = newCellMap.get(key);

        // If both values are objects, we need to do deep comparison
        if (
          typeof value === 'object' &&
          value !== null &&
          typeof newValue === 'object' &&
          newValue !== null
        ) {
          for (const prop in value) {
            if (value[prop] !== newValue[prop]) {
              return true;
            }
          }

          for (const prop in newValue) {
            if (value[prop] !== newValue[prop]) {
              return true;
            }
          }
        }
        // Simple value comparison for non-objects
        else if (value !== newValue) {
          return true;
        }
      }
    }
  }

  return false;
}
