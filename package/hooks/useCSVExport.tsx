import { Sheet } from '@fortune-sheet/core';

import { MutableRefObject } from 'react';

export const handleExportToCSV = (workbookRef: MutableRefObject<{ getAllSheets: () => any[] } | null>,
    ydocRef: MutableRefObject<any>,
    dsheetId: string
) => {
    console.log('handleExportToCSV');
    if (!workbookRef.current) return;

    try {
        // Get the current Luckysheet data
        const ydoc = ydocRef.current;
        const sheetArray = ydoc.getArray(dsheetId);
        const preSheetArray = Array.from(sheetArray) as Sheet[];
        const sheetData = preSheetArray;
        //const sheetData = workbookRef.current.getData();

        // Get the active sheet - typically we export only the active sheet to CSV
        // If you want to export all sheets, you'd need to generate multiple CSV files
        const activeSheet = sheetData.find(sheet => sheet.status === 1) || sheetData[0];
        console.log('activeSheet:', activeSheet);

        if (!activeSheet || !activeSheet.celldata || activeSheet.celldata.length === 0) {
            console.error('No data to export');
            return;
        }

        // Find the maximum row and column indices
        let maxRow = 0;
        let maxCol = 0;

        activeSheet.celldata.forEach(cell => {
            maxRow = Math.max(maxRow, cell.r);
            maxCol = Math.max(maxCol, cell.c);
        });

        // Initialize the 2D array with the correct dimensions
        const rows: string[][] = [];
        for (let i = 0; i <= maxRow; i++) {
            rows[i] = Array(maxCol + 1).fill('');
        }

        // Fill in the data
        activeSheet.celldata.forEach(cell => {
            const value = cell.v && cell.v.v !== undefined && cell.v.v !== null ? cell.v.v : '';
            rows[cell.r][cell.c] = String(value);
        });

        // Convert rows to CSV format
        const csvContent = rows.map(row => {
            return row.map(cell => {
                // Handle values that need to be quoted (contain commas, quotes, or newlines)
                if (cell === null || cell === undefined) {
                    return '';
                }

                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    // Escape quotes by doubling them and wrap in quotes
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',');
        }).join('\n');

        // Create and download the CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${activeSheet.name || 'flvSheet'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('CSV export successful!');
    } catch (error) {
        console.error('CSV export failed:', error);
    }
};