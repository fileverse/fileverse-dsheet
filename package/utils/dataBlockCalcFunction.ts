import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { formulaResponseUiSync } from './formula-ui-sync';
import { executeStringFunction } from './executeStringFunction';
export const dataBlockCalcFunctionHandler = ({ dataBlockCalcFunction, sheetEditorRef, currentRow, currentColumn }:
  {
    dataBlockCalcFunction: Array<{ row: number, column: number }>
    sheetEditorRef: React.RefObject<WorkbookInstance | null>,
    currentRow: number,
    currentColumn: number,
  }
) => {

  if (dataBlockCalcFunction && dataBlockCalcFunction?.length > 0) {
    dataBlockCalcFunction.forEach((dataBlock: { row: number, column: number }) => {
      //@ts-expect-error later
      const dataBlockValue = sheetEditorRef?.current?.getSheet().data[dataBlock.row][dataBlock.column];
      const currentFormulaName = dataBlockValue?.f?.match(/^=([A-Z0-9_]+)\s*\(/)?.[1];
      // @ts-expect-error later
      const isCurrentIncludedInReference = dataBlock?.rowRefrenced?.includes(currentRow) && dataBlock.columnRefrenced?.includes(currentColumn) && dataBlock.formulaName?.includes(currentFormulaName);
      if (!isCurrentIncludedInReference) return
      if (!dataBlockValue || dataBlockValue?.v === "") return
      const funcString = dataBlockValue?.f?.split('=')[1] as string
      executeStringFunction(funcString, sheetEditorRef).then((result) => {
        formulaResponseUiSync({
          row: dataBlock.row,
          column: dataBlock.column,
          newValue: dataBlockValue as Record<string, string>,
          apiData: result as Array<Record<string, object>>,
          sheetEditorRef
        })
      })
    })
  }
};