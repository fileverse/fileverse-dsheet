// @ts-nocheck
import { WorkbookInstance } from '@sheet-engine/react';
import { formulaResponseUiSync } from './formula-ui-sync';
import { executeStringFunction } from './executeStringFunction';
import { SmartContractQueryHandler } from './after-update-cell';

const isReferencedCell = (
  dataBlock: {
    rowRefrenced?: number[];
    columnRefrenced?: number[];
  },
  currentRow: number,
  currentColumn: number,
): boolean =>
  dataBlock.rowRefrenced?.some(
    (row, index) =>
      row === currentRow && dataBlock.columnRefrenced?.[index] === currentColumn,
  ) ?? false;

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
  const currentSheetId =
    sheetEditorRef?.current?.getWorkbookContext()?.currentSheetId;
  // @ts-expect-error later
  const currentSheetDataBlock = dataBlockCalcFunction[currentSheetId];
  const currentSheetDataBlockList: Array<{ row: number; column: number }> =
    currentSheetDataBlock ? Object.values(currentSheetDataBlock) : [];

  if (currentSheetDataBlockList && currentSheetDataBlockList?.length > 0) {
    currentSheetDataBlockList.forEach(
      (dataBlock: { row: number; column: number }) => {
        let sheet;
        try {
          sheet = sheetEditorRef.current?.getSheet();
        } catch {
          return;
        }
        const dataBlockValue = sheet?.data?.[dataBlock.row]?.[dataBlock.column];
        const currentFormulaName = dataBlockValue?.f
          ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
          ?.toUpperCase();

        const isCurrentIncludedInReference = isReferencedCell(
          dataBlock,
          currentRow,
          currentColumn,
        );
        const formulaNameMatches =
          !dataBlock.formulaName ||
          !currentFormulaName ||
          dataBlock.formulaName === currentFormulaName;

        if (!isCurrentIncludedInReference || !formulaNameMatches) return;
        if (!dataBlockValue || dataBlockValue?.v === '') return;
        const formulaSource = dataBlockValue?.f ?? dataBlock.formula;
        const funcString = formulaSource?.split('=')[1] as string;
        if (!funcString) return;
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
          newValue: { ...dataBlockValue, f: formulaSource },
          handleSmartContractQuery,
        })
          .then((result) => {
            if (!result) return; // executeStringFunction already handled the error on the cell
            formulaResponseUiSync({
              row: dataBlock.row,
              column: dataBlock.column,
              newValue: dataBlockValue as Record<string, string>,
              apiData: result as Array<Record<string, object>>,
              sheetEditorRef,
            });
          })
          .catch((error) => {
            // Safety net: surface any unexpected rejection as a cell-level error.
            sheetEditorRef.current?.setCellError(
              dataBlock.row,
              dataBlock.column,
              {
                title: 'Formula Error',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Invalid function call format',
              },
            );
          });
      },
    );
  }
};
