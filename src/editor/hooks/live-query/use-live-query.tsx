/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import {
  animateChangedCell,
  LiveQueryData,
  Sheet,
  WorkbookInstance,
} from '@sheet-engine/react';
import { getFlowdata, getSheetIndex } from '@sheet-engine/core';
import { executeStringFunction } from '../../utils/executeStringFunction';
import { formulaResponseUiSync } from '../../utils/formula-ui-sync';
import { isSupported } from './helpers';
import { isDatablockError } from '../../utils/datablock-error-utils';
import { handleDataBlockError } from '../../utils/data-block-error-handler';
import type { ApiKeyStorage } from '../../utils/api-key-storage';
import type { OpenApiKeyModalFn } from '../../utils/data-block-error-handler';
import type { DataBlockEvent } from '../../types';
import { defaultApiKeyStorage } from '../../utils/api-key-storage';

export const LIVE_QUERY_ERROR = 'LIVE_QUERY_ERROR';

export const useLiveQuery = (
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  apiKeyStorage: ApiKeyStorage = defaultApiKeyStorage,
  openApiKeyModal?: OpenApiKeyModalFn,
  onDataBlockEvent?: (event: DataBlockEvent) => void,
  enableLiveQuery = false,
  refreshRate = 20000,
) => {
  const liveQueryRef = useRef<Record<string, Map<string, LiveQueryData>>>({});

  const registerLiveQueryData = (
    subsheetIndex: number,
    queryData: LiveQueryData,
  ) => {
    if (!liveQueryRef.current[subsheetIndex]) {
      liveQueryRef.current[subsheetIndex] = new Map();
    }
    liveQueryRef.current[subsheetIndex].set(queryData.data.id, queryData);
    if (!sheetEditorRef.current) {
      throw new Error('Cannot update live query list. Ref is undefined');
    }
    sheetEditorRef.current.updateSheetLiveQueryList(subsheetIndex, queryData);
  };
  const handleLiveQuery = (subsheetIndex: number, queryData: LiveQueryData) => {
    const { data } = queryData;
    const functionName = data.name;
    if (!isSupported(functionName, data.function)) return;
    registerLiveQueryData(subsheetIndex, queryData);
  };

  const initialiseLiveQueryData = (sheets: Sheet[]) => {
    sheets.forEach((sheet, index) => {
      if (!sheet.liveQueryList) return;
      const sheetLiveQueryList = Object.entries(sheet.liveQueryList);
      const list = new Map(sheetLiveQueryList);
      const previousList = liveQueryRef.current[index] || new Map();
      liveQueryRef.current[index] = new Map([
        ...Array.from(previousList),
        ...Array.from(list),
      ]);
    });
  };
  const removeFromLiveQueryList = (subSheetIndex: number, id: string) => {
    liveQueryRef.current[subSheetIndex]?.delete(id);
    sheetEditorRef.current?.removeFromLiveQueryList(subSheetIndex, id);
  };

  const handleQuery = async (functionRecord: LiveQueryData) => {
    const functionToExec = functionRecord.data.function.split('=')[1];
    try {
      switch (functionRecord.data.name.toLowerCase()) {
        case 'coingecko': {
          const { cellData: cachedCellData, data } = functionRecord;
          const { row, column } = data;
          const context = sheetEditorRef.current?.getWorkbookContext();
          const latestCellData = getFlowdata(context)?.[row]?.[column];
          const subSheetIndex = getSheetIndex(context!, data.subSheetId);

          const normalize = (s: string | undefined) => {
            if (!s) return s;
            s.replace(/\\"/g, '"');
          };

          if (
            !latestCellData?.f ||
            normalize(latestCellData?.f) !== normalize(cachedCellData.f)
          ) {
            // do not execute function if function in cell already changed
            if (subSheetIndex?.toString) {
              removeFromLiveQueryList(subSheetIndex, data.id);
            }
            return;
          }
          const result: any = await executeStringFunction({
            functionCallString: functionToExec,
            sheetEditorRef,
          });
          if (isDatablockError(result)) {
            result.type = LIVE_QUERY_ERROR;
            if (openApiKeyModal) {
              await handleDataBlockError({
                data: result,
                sheetEditorRef,
                row,
                column,
                newValue: cachedCellData as any,
                apiKeyStorage,
                openApiKeyModal,
                onDataBlockEvent,
              });
            }
            return;
          }
          const newPriceDataResponse = result as Array<Record<string, number>>;
          const newPriceData = newPriceDataResponse[0];
          if (!newPriceData) return;
          const [newPriceCurrency, newPrice] = Object.entries(newPriceData)[0];
          const oldPriceDataValue = functionRecord.data.value as any;
          const oldPriceData = oldPriceDataValue[0];

          if (oldPriceData) {
            const [oldPriceCurrency, oldPrice] =
              Object.entries(oldPriceData)[0];
            const isPriceUpdated =
              newPriceCurrency !== oldPriceCurrency || newPrice !== oldPrice;
            if (!isPriceUpdated) {
              return;
            }
          }

          formulaResponseUiSync({
            row,
            column,
            newValue: cachedCellData as Record<string, string>,
            apiData: newPriceDataResponse as any,
            sheetEditorRef,
            shouldIgnoreUsdValue: true,
          });
          if (subSheetIndex?.toString()) {
            // update live query data value with newPriceDataResponse
            const newQueryData = {
              ...functionRecord,
              data: { ...data, value: newPriceDataResponse },
            };
            liveQueryRef.current[subSheetIndex].set(
              newQueryData.data.id,
              newQueryData,
            );
            sheetEditorRef.current?.updateSheetLiveQueryList(
              subSheetIndex!,
              newQueryData,
            );
          }
          animateChangedCell(context!.currentSheetId, row, column);
          // TODO: see a way to improve this
          sheetEditorRef.current?.calculateSubSheetFormula(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            sheetEditorRef.current?.getSheet()?.id,
          );
          return;
        }
      }
    } catch (error: any) {
      if (openApiKeyModal) {
        await handleDataBlockError({
          data: {
            message: error?.message || 'Live query failed',
            functionName: 'COINGECKO',
            type: LIVE_QUERY_ERROR,
          },
          sheetEditorRef,
          row: functionRecord.data.row,
          column: functionRecord.data.column,
          newValue: functionRecord.cellData as any,
          apiKeyStorage,
          openApiKeyModal,
          onDataBlockEvent,
        });
      }
    }
  };

  const isLiveQueryIntervalRunningRef = useRef(false);

  const handleLiveQueryInterval = async () => {
    if (isLiveQueryIntervalRunningRef.current) return;
    try {
      isLiveQueryIntervalRunningRef.current = true;
      const context = sheetEditorRef.current?.getWorkbookContext();
      if (!context) return;
      const activeSubsheetId = context.currentSheetId;
      const activeSheetIndex = getSheetIndex(context, activeSubsheetId);
      if (
        !activeSheetIndex?.toString() ||
        !liveQueryRef.current[activeSheetIndex]
      )
        return;

      const queries: Promise<any>[] = [];
      for (const [, liveQueryRecord] of Array.from(
        liveQueryRef.current[activeSheetIndex],
      )) {
        queries.push(handleQuery(liveQueryRecord));
      }
      await Promise.allSettled(queries);
    } catch (error: any) {
      if (openApiKeyModal) {
        await handleDataBlockError({
          data: {
            message: error?.message || 'Live query failed',
            functionName: 'COINGECKO',
            type: LIVE_QUERY_ERROR,
          },
          sheetEditorRef,
          row: 0,
          column: 0,
          newValue: {} as any,
          apiKeyStorage,
          openApiKeyModal,
          onDataBlockEvent,
        });
      }
    } finally {
      isLiveQueryIntervalRunningRef.current = false;
    }
  };

  useEffect(() => {
    if (!enableLiveQuery || !sheetEditorRef) return;
    const interval = setInterval(() => {
      handleLiveQueryInterval();
    }, refreshRate);

    return () => clearInterval(interval);
  }, [enableLiveQuery, refreshRate]);
  return { handleLiveQuery, initialiseLiveQueryData };
};
