import { Sheet } from '@fortune-sheet/core';
/**
 * Compare two spreadsheets' cell data and check if anything changed
 * @param {Array} oldSheets - Original sheets data
 * @param {Array} newSheets - New sheets data
 * @returns {boolean} - true if any cell data changed, false if identical
 */
export function isSpreadsheetChanged(oldSheets: Sheet[], newSheets: Sheet[]) {
    // Early escape if sheets count differs
    if (!oldSheets || !newSheets || oldSheets.length !== newSheets.length) {
        console.log('whyyyyyyy')
        return true;
    }

    // Compare just the first sheet as requested
    if (oldSheets.length > 0) {
        for (let i = 0; i < oldSheets.length; i++) {
            const oldSheet = oldSheets[i];
            const newSheet = newSheets[i];
            console.log('sheet number:', i, 'oldSheet:', oldSheet, 'newSheet:', newSheet);

            // Handle missing celldata case
            const oldCellData = oldSheet?.celldata || [];
            const newCellData = newSheet?.celldata || [];

            // Create maps for comparison (only care about non-null values)
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

            console.log('oldCellMap:', oldCellMap);
            console.log('newCellMap:', newCellMap);

            // Different number of non-null cells means change
            if (oldCellMap.size !== newCellMap.size) {
                console.log('Different number of non-null cells:', oldCellMap.size, newCellMap.size);
                return true;
            }

            // Check each non-null cell specifically
            for (const [key, value] of oldCellMap.entries()) {
                if (!newCellMap.has(key)) {
                    console.log('Cell removed:', key);
                    return true;
                }

                const newValue = newCellMap.get(key);

                // If both values are objects, we need to do deep comparison
                if (typeof value === 'object' && value !== null &&
                    typeof newValue === 'object' && newValue !== null) {

                    // // Compare the most relevant fields from the cell value object
                    // if (value.m !== newValue.m || value.v !== newValue.v) {
                    //     console.log('Cell value changed:', key, value, newValue);
                    //     return true;
                    // }

                    // // If ct exists and is different
                    // if (value.ct && newValue.ct) {
                    //     if (value.ct.fa !== newValue.ct.fa || value.ct.t !== newValue.ct.t) {
                    //         console.log('Cell formatting changed:', key);
                    //         return true;
                    //     }
                    // } else if ((value.ct && !newValue.ct) || (!value.ct && newValue.ct)) {
                    //     console.log('Cell formatting presence changed:', key);
                    //     return true;
                    // }

                    for (const prop in value) {
                        if (value[prop] !== newValue[prop]) {
                            console.log(`Property '${prop}' changed:`, key, value[prop], newValue[prop]);
                            return true;
                        }
                    }

                    for (const prop in newValue) {
                        if (value[prop] !== newValue[prop]) {
                            console.log(`Property '${prop}' changed:`, key, value[prop], newValue[prop]);
                            return true;
                        }
                    }
                }
                // Simple value comparison for non-objects
                else if (value !== newValue) {
                    console.log('Simple cell value changed:', key, value, newValue);
                    return true;
                }
            }
        }
    }

    // No differences found
    console.log('No differences found');
    return false;
}