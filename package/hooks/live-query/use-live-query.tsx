/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import {
  animateChangedCell,
  LiveQueryData,
  Sheet,
  WorkbookInstance,
} from '@fileverse-dev/fortune-react';
import { getFlowdata, getSheetIndex } from '@fileverse-dev/fortune-core';
import { executeStringFunction } from '../../utils/executeStringFunction';
import { formulaResponseUiSync } from '../../utils/formula-ui-sync';
import { isSupported } from './helpers';
import {
  DataBlockApiKeyHandlerType,
  ErrorMessageHandlerReturnType,
} from '../../types';

export const useLiveQuery = (
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType,
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
    switch (functionRecord.data.name.toLowerCase()) {
      case 'coingecko': {
        const { cellData: cachedCellData, data } = functionRecord;
        const { row, column } = data;
        const context = sheetEditorRef.current?.getWorkbookContext();
        const latestCellData = getFlowdata(context)?.[row]?.[column];
        const subSheetIndex = getSheetIndex(context!, data.subSheetId);

        if (!latestCellData?.f || latestCellData?.f !== cachedCellData.f) {
          // do not execute function if function in cell already changed
          if (subSheetIndex?.toString) {
            removeFromLiveQueryList(subSheetIndex, data.id);
          }
          return;
        }
        const oldPriceDataValue = functionRecord.data.value as any;
        const oldPriceData = oldPriceDataValue[0];
        const [oldPriceCurrency, oldPrice] = Object.entries(oldPriceData)[0];
        const result = await executeStringFunction(
          functionToExec,
          sheetEditorRef,
        );
        const newPriceDataResponse = result as Array<Record<string, number>>;
        const newPriceData = newPriceDataResponse[0];
        const [newPriceCurrency, newPrice] = Object.entries(newPriceData)[0];
        const isPriceUpdated =
          newPriceCurrency !== oldPriceCurrency || newPrice !== oldPrice;
        if (!isPriceUpdated) {
          return;
        }
        formulaResponseUiSync({
          row,
          column,
          newValue: cachedCellData as Record<string, string>,
          apiData: newPriceDataResponse as any,
          sheetEditorRef,
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
        animateChangedCell(context!.currentSheetId, row + 1, column);
        // TODO: see a way to improve this
        sheetEditorRef.current?.calculateSubSheetFormula(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          sheetEditorRef.current?.getSheet()?.id,
        );
        return;
      }
    }
  };

  useEffect(() => {
    if (!enableLiveQuery || !sheetEditorRef) return;
    const interval = setInterval(() => {
      try {
        const context = sheetEditorRef.current?.getWorkbookContext();
        if (!context) return;
        const activeSubsheetId = context.currentSheetId;
        const activeSheetIndex = getSheetIndex(context, activeSubsheetId);
        if (
          !activeSheetIndex?.toString() ||
          !liveQueryRef.current[activeSheetIndex]
        )
          return;
        for (const [, liveQueryRecord] of Array.from(
          liveQueryRef.current[activeSheetIndex],
        )) {
          // only execute live query on active subsheet
          handleQuery(liveQueryRecord);
        }
      } catch (error: any) {
        const data: ErrorMessageHandlerReturnType = {
          message: error?.message || 'Live query failed',
          functionName: 'COINGECKO',
          type: 'LIVE_QUERY_ERROR',
        };
        dataBlockApiKeyHandler?.({
          data,
        } as any);
      }
    }, refreshRate);

    return () => clearInterval(interval);
  }, [enableLiveQuery, refreshRate]);
  return { handleLiveQuery, initialiseLiveQueryData };
};
