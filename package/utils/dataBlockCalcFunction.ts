// @ts-nocheck
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { formulaResponseUiSync } from './formula-ui-sync';
import { executeStringFunction } from './executeStringFunction';
import { SmartContractQueryHandler } from './after-update-cell';

export const dataBlockCalcFunctionHandler = ({
  dataBlockCalcFunction,
  sheetEditorRef,
  currentRow,
  currentColumn,
  handleSmartContractQuery,
}: {
  dataBlockCalcFunction: { [key: string]: { [key: string]: any } };
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  currentRow: number;
  currentColumn: number;
  handleSmartContractQuery?: SmartContractQueryHandler;
}) => {
  console.log('dataBlockCalcFunctionHandler getting called');
  const currentSheetId =
    sheetEditorRef?.current?.getWorkbookContext()?.currentSheetId;
  // @ts-expect-error later
  const currentSheetDataBlock = dataBlockCalcFunction[currentSheetId];
  const currentSheetDataBlockList: Array<{ row: number; column: number }> =
    currentSheetDataBlock ? Object.values(currentSheetDataBlock) : [];
  console.log('currentSheetDataBlockList', currentSheetDataBlockList);

  if (currentSheetDataBlockList && currentSheetDataBlockList?.length > 0) {
    currentSheetDataBlockList.forEach(
      (dataBlock: { row: number; column: number }) => {
        console.log('dataBlock', dataBlock);
        const dataBlockValue =
          //@ts-expect-error later
          sheetEditorRef?.current?.getSheet().data[dataBlock.row][
          dataBlock.column
          ];
        const currentFormulaName = dataBlockValue?.f
          ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
          ?.toUpperCase();

        console.log('currentFormulaName', currentFormulaName);

        const isCurrentIncludedInReference =
          dataBlock?.rowRefrenced?.includes(currentRow) &&
          dataBlock.columnRefrenced?.includes(currentColumn) &&
          dataBlock.formulaName?.includes(currentFormulaName);
        console.log(
          'isCurrentIncludedInReference',
          isCurrentIncludedInReference,
        )
        if (!isCurrentIncludedInReference) return;
        if (!dataBlockValue || dataBlockValue?.v === '') return;
        const funcString = dataBlockValue?.f?.split('=')[1] as string;
        sheetEditorRef.current?.setCellValue(dataBlock.row, dataBlock.column, {
          ...dataBlockValue,
          m: 'Updating...',
          v: 'Updating...',
        });
        executeStringFunction({
          functionCallString: funcString,
          sheetEditorRef,
          dataBlockRow: dataBlock.row,
          dataBlockColumn: dataBlock.column,
          newValue: dataBlockValue,
          handleSmartContractQuery,
        }).then((result) => {
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
