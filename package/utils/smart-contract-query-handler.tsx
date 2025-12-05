import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import {
  SheetSmartContractApi,
  SmartContractQueryHandler,
  SmartContractResponse,
} from './after-update-cell';
import { Cell } from '@fileverse-dev/fortune-react';
import { formulaResponseUiSync } from './formula-ui-sync';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSmartContractResponse = (value: any) => {
  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);

  return isObject && value?.responseType === 'smart-contract';
};

export const smartContractQueryHandlerFunction = async ({
  result,
  handleSmartContractQuery,
  sheetEditorRef,
  dataBlockRow,
  dataBlockColumn,
  newValue,
}: {
  result: unknown;
  handleSmartContractQuery: SmartContractQueryHandler;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  dataBlockRow: number;
  dataBlockColumn: number;
  newValue: Cell;
}) => {
  if (!handleSmartContractQuery) {
    throw new Error('Smart contract handler is missing');
  }

  const api: SheetSmartContractApi = {
    sheetEditorRef: sheetEditorRef as React.RefObject<WorkbookInstance | null>,
    row: dataBlockRow as number,
    column: dataBlockColumn as number,
    newValue: newValue as Cell,
    formulaResponseUiSync: formulaResponseUiSync,
  };

  const { callSignature } = result as SmartContractResponse;

  const smartContractHandler = handleSmartContractQuery(api);
  await smartContractHandler(callSignature);
  return;
};
