import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { formulaResponseUiSync } from './formula-ui-sync';
import { executeStringFunction } from './executeStringFunction';
export const dataBlockCalcFunctionHandler = ({
  dataBlockCalcFunction,
  sheetEditorRef,
  currentRow,
  currentColumn,
}: {
  dataBlockCalcFunction: { [key: string]: { [key: string]: any } };
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  currentRow: number;
  currentColumn: number;
}) => {
  const currentSheetId =
    sheetEditorRef?.current?.getWorkbookContext()?.currentSheetId;
  // @ts-expect-error later
  const currentSheetDataBlock = dataBlockCalcFunction[currentSheetId];
  const currentSheetDataBlockList: Array<{ row: number; column: number }> =
    currentSheetDataBlock ? Object.values(currentSheetDataBlock) : [];

  if (currentSheetDataBlockList && currentSheetDataBlockList?.length > 0) {
    currentSheetDataBlockList.forEach(
      (dataBlock: { row: number; column: number }) => {
        //@ts-expect-error later
        const dataBlockValue =
          sheetEditorRef?.current?.getSheet().data[dataBlock.row][
            dataBlock.column
          ];
        const currentFormulaName = dataBlockValue?.f
          ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
          ?.toUpperCase();
        // @ts-expect-error later
        const isCurrentIncludedInReference =
          dataBlock?.rowRefrenced?.includes(currentRow) &&
          dataBlock.columnRefrenced?.includes(currentColumn) &&
          dataBlock.formulaName?.includes(currentFormulaName);
        if (!isCurrentIncludedInReference) return;
        if (!dataBlockValue || dataBlockValue?.v === '') return;
        const funcString = dataBlockValue?.f?.split('=')[1] as string;
        executeStringFunction(funcString, sheetEditorRef).then((result) => {
          formulaResponseUiSync({
            row: dataBlock.row,
            column: dataBlock.column,
            newValue: dataBlockValue as Record<string, string>,
            apiData: result as Array<Record<string, object>>,
            sheetEditorRef,
          });
        });
      },
    );
  }
};
