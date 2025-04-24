import * as XLSX from 'xlsx';
import { Sheet } from '@fortune-sheet/core';

import { MutableRefObject } from 'react';

export const handleExportToXLSX = (
    workbookRef: MutableRefObject<{ getAllSheets: () => any[] } | null>,
    ydocRef: MutableRefObject<any>,
    dsheetId: string
) => {
    if (!workbookRef.current) return;

    try {
        // Get the current Luckysheet data
        const ydoc = ydocRef.current;
        const sheetArray = ydoc.getArray(dsheetId);
        const preSheetArray = Array.from(sheetArray) as Sheet[];
        const sheetData = preSheetArray;
        console.log('sheetData:', sheetData);

        const sheetwithData = workbookRef.current.getAllSheets();

        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // Process each sheet
        sheetData.forEach((sheet, index) => {
            // Convert the celldata to a 2D array format expected by SheetJS
            console.log('sheet:', sheet);
            const rows = sheetwithData[index]?.data || [];
            console.log('rows:', rows, 'sheetwithData:', sheetwithData[index]);

            // Find the maximum row and column indices
            let maxRow = 0;
            let maxCol = 0;

            (sheet.celldata ?? []).forEach((cell: { r: number; c: number }) => {
                maxRow = Math.max(maxRow, cell.r);
                maxCol = Math.max(maxCol, cell.c);
            });
            const worksheet = XLSX.utils.aoa_to_sheet(rows);

            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
        });

        // Generate the XLSX file and trigger download
        XLSX.writeFile(workbook, 'luckysheet_export.xlsx');

        console.log('Export successful!');
    } catch (error) {
        console.error('Export failed:', error);
    }
};