import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { Sheet } from '@fileverse-dev/fortune-core';

export const updateSheetUIToYjs = ({
  sheetEditorRef,
  sheetData,
}: {
  sheetEditorRef: WorkbookInstance;
  sheetData: Sheet[];
}) => {
  sheetData.map((singleSheet, index) => {
    console.log('singleSheet', singleSheet, singleSheet.status);
    if (singleSheet.config?.columnlen)
      sheetEditorRef?.setColumnWidth(singleSheet.config?.columnlen);
    if (singleSheet.config?.rowlen)
      sheetEditorRef?.setRowHeight(singleSheet.config?.rowlen);
    if (index === 0) {
      singleSheet.celldata?.map((singleCellData) => {
        if (singleCellData.r <= 120 && singleCellData !== null)
          sheetEditorRef?.setCellValue(
            singleCellData.r,
            singleCellData.c,
            singleCellData.v,
          );
      });
    }
  });
};
