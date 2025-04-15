import { WorkbookInstance } from '@fortune-sheet/react';
import { Sheet } from '@fortune-sheet/core';

export const updateSheetUIToYjs = ({ sheetEditorRef, sheetData }: { sheetEditorRef: WorkbookInstance, sheetData: Sheet[] }) => {
    sheetData.map((singleSheet) => {
        singleSheet.celldata?.map((singleCellData, index) => {
            const row = Math.floor(index / (singleSheet.column ?? 1));
            const col = index % (singleSheet.column ?? 1);

            if (singleCellData !== null && singleCellData.v !== null && singleCellData.v.v) {
                sheetEditorRef?.setCellValue(row, col, singleCellData.v)
            } else if (singleCellData !== null && singleCellData.v !== null) {
                sheetEditorRef?.setCellValue(row, col, null)
            }
        })
    })
}