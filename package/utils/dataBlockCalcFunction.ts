import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { formulaResponseUiSync } from './formula-ui-sync';
import { executeStringFunction } from './executeStringFunction';
export const dataBlockCalcFunctionHandler = ({ dataBlockCalcFunction, sheetEditorRef }:
  {
    dataBlockCalcFunction: Array<{ row: number, column: number, sheetId: string }>
    sheetEditorRef: React.RefObject<WorkbookInstance | null>
  }
) => {


  if (dataBlockCalcFunction && dataBlockCalcFunction?.length > 0) {
    dataBlockCalcFunction.forEach((dataBlock: { row: number, column: number, sheetId: string }) => {
      //@ts-expect-error later
      const dataBlockValue = sheetEditorRef?.current?.getSheet().data[dataBlock.row][dataBlock.column]
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