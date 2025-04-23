import { WorkbookInstance } from '@fortune-sheet/react';
import { Sheet } from '@fortune-sheet/core';

export const updateSheetUIToYjs = ({ sheetEditorRef, sheetData }: { sheetEditorRef: WorkbookInstance, sheetData: Sheet[] }) => {
    sheetData.map((singleSheet) => {
        console.log('singleSheet', singleSheet);
        singleSheet.celldata?.map((singleCellData) => {
            if (singleCellData.r <= 83 && singleCellData !== null)
                sheetEditorRef?.setCellValue(singleCellData.r, singleCellData.c, singleCellData.v)
            // } else if (singleCellData !== null && singleCellData.v !== null) {
            //     sheetEditorRef?.setCellValue(row, col, null)
            // }
        })
    })
}