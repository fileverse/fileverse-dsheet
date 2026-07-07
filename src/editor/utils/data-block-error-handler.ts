import { Cell, WorkbookInstance } from '@sheet-engine/react';
import {
  DataBlockEvent,
  ErrorMessageHandlerReturnType,
  RateLimitError,
} from '../types';
import { ERROR_MESSAGES_FLAG } from '../constants/shared-constants';
import { ApiKeyStorage } from './api-key-storage';
import { executeStringFunction } from './executeStringFunction';
import { formulaResponseUiSync } from './formula-ui-sync';
import { isDatablockError } from './datablock-error-utils';
import { LIVE_QUERY_ERROR } from '../hooks/live-query/use-live-query';
import type { SmartContractQueryHandler } from './after-update-cell';

export type OpenApiKeyModalFn = (
  apiKeyName: string,
  callbacks: {
    onSave: (key: string) => void;
    onClose: () => void;
  },
) => void;

export interface DataBlockErrorHandlerParams {
  data: ErrorMessageHandlerReturnType;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  row: number;
  column: number;
  newValue: Cell;
  apiKeyStorage: ApiKeyStorage;
  openApiKeyModal: OpenApiKeyModalFn;
  onDataBlockEvent?: (event: DataBlockEvent) => void;
  handleSmartContractQuery?: SmartContractQueryHandler;
}

const applyFormulaResult = async ({
  res,
  row,
  column,
  newValue,
  sheetEditorRef,
  formulaName,
}: {
  res: unknown;
  row: number;
  column: number;
  newValue: Cell;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  formulaName?: string;
}) => {
  if (Array.isArray(res)) {
    formulaResponseUiSync({
      row,
      column,
      newValue: newValue as Record<string, string>,
      apiData: res as Array<Record<string, object>>,
      sheetEditorRef,
      shouldIgnoreUsdValue: formulaName === 'COINGECKO',
    });
    return;
  }

  sheetEditorRef.current?.setCellValue(row, column, {
    ...newValue,
    m: String(res),
    isDataBlockFormula: true,
  });
};

export const handleDataBlockError = async ({
  data,
  sheetEditorRef,
  row,
  column,
  newValue,
  apiKeyStorage,
  openApiKeyModal,
  onDataBlockEvent,
  handleSmartContractQuery,
}: DataBlockErrorHandlerParams): Promise<void> => {
  if (data.type === LIVE_QUERY_ERROR) return;

  onDataBlockEvent?.({
    type: 'error',
    errorType: data.type,
    functionName: data.functionName,
  });

  if (data.type === ERROR_MESSAGES_FLAG.RATE_LIMIT) {
    const apiKeyName =
      (data as RateLimitError).apiKeyName || data.functionName || '';

    onDataBlockEvent?.({
      type: 'api-key-required',
      apiKeyName,
      functionName: data.functionName,
    });

    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      m: 'Waiting for API key',
    });

    await new Promise<void>((resolve) => {
      openApiKeyModal(apiKeyName, {
        onSave: (key) => {
          apiKeyStorage.set(apiKeyName, key);
          onDataBlockEvent?.({
            type: 'api-key-saved',
            apiKeyName,
            functionName: data.functionName,
          });
          resolve();
        },
        onClose: () => resolve(),
      });
    });

    const storedKey = apiKeyStorage.get(apiKeyName);
    if (!storedKey || storedKey === 'DEFAULT_PROXY_MODE') {
      sheetEditorRef.current?.setCellValue(row, column, {
        ...newValue,
        m: data.message,
        isDataBlockFormula: true,
      });
      return;
    }

    const funStr = newValue.f?.split('=')[1];
    if (!funStr) return;

    onDataBlockEvent?.({
      type: 'retry',
      functionName: data.functionName,
    });

    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      m: 'Loading ...',
    });

    const res = await executeStringFunction({
      functionCallString: funStr,
      sheetEditorRef,
      dataBlockRow: row,
      dataBlockColumn: column,
      handleSmartContractQuery,
      newValue,
    });

    if (isDatablockError(res)) {
      await handleDataBlockError({
        data: res as ErrorMessageHandlerReturnType,
        sheetEditorRef,
        row,
        column,
        newValue,
        apiKeyStorage,
        openApiKeyModal,
        onDataBlockEvent,
        handleSmartContractQuery,
      });
      return;
    }

    await applyFormulaResult({
      res,
      row,
      column,
      newValue,
      sheetEditorRef,
      formulaName: data.functionName,
    });

    onDataBlockEvent?.({
      type: 'success',
      functionName: data.functionName,
    });
    return;
  }

  sheetEditorRef.current?.setCellValue(row, column, {
    ...newValue,
    m: `#${data.type}`,
    isDataBlockFormula: true,
  });
};
