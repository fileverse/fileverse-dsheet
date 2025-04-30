import { WorkbookInstance } from '@fortune-sheet/react';
import { Sheet } from '@fortune-sheet/core';

export const updateSheetUIToYjs = (
    { sheetEditorRef, sheetData }:
        { sheetEditorRef: WorkbookInstance, sheetData: Sheet[] }) => {

    sheetData.map((singleSheet, index) => {
        console.log('singleSheet', singleSheet, singleSheet.status);
        if (index === 0) {
            singleSheet.celldata?.map((singleCellData) => {
                if (singleCellData.r <= 120 && singleCellData !== null)
                    sheetEditorRef?.setCellValue(singleCellData.r, singleCellData.c, singleCellData.v)
            })
        }
    })

}