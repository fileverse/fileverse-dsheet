/* eslint-disable @typescript-eslint/no-explicit-any */
import { SUPPORTED_LIVE_QUERY_FUNCTIONS } from './constants';
import { useEffect, useRef } from 'react';
import {
  executeStringFunction,
  formulaResponseUiSync,
  getSheetIndex,
  WorkbookInstance,
} from '@fileverse-dev/dsheet';
import { LiveQueryData, Sheet } from '@fileverse-dev/fortune-react';
import { getFlowdata } from '@fileverse-dev/fortune-core';

export const useLiveQuery = (
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  enableLiveQuery = false,
  isDevMode?: boolean,
  refreshRate = 5000,
) => {
  const liveQueryRef = useRef<Record<string, Map<string, LiveQueryData>>>({});
  const isSupported = (functionName: string) => {
    return SUPPORTED_LIVE_QUERY_FUNCTIONS.includes(functionName.toLowerCase());
  };
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

    if (!isSupported(functionName)) return;
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
        const { cellData, data } = functionRecord;
        const { row, column } = data;
        const context = sheetEditorRef.current?.getWorkbookContext();
        const cell = getFlowdata(context)?.[row]?.[column];
        const subSheetIndex = getSheetIndex(context!, data.subSheetId);

        if (!cell?.f || cell?.f !== cellData.f) {
          // do not execute function if function in cell already changed
          if (subSheetIndex?.toString) {
            removeFromLiveQueryList(subSheetIndex, data.id);
          }
          return;
        }
        const oldPriceDataValue = functionRecord.data.value as any;
        const oldPriceData = oldPriceDataValue[0];
        const [oldPriceCurrency, oldPrice] = Object.entries(oldPriceData)[0];
        let apiData = [] as any;
        if (isDevMode) {
          const randomPriceData = [
            { [oldPriceCurrency]: Math.floor(Math.random() * 28848) },
          ];
          apiData = randomPriceData;
        } else {
          const result = await executeStringFunction(functionToExec);
          const newPriceDataResponse = result as Array<Record<string, number>>;
          const newPriceData = newPriceDataResponse[0];
          const [newPriceCurrency, newPrice] = Object.entries(newPriceData)[0];
          const isPriceUpdated =
            newPriceCurrency !== oldPriceCurrency || newPrice !== oldPrice;
          if (isPriceUpdated) {
            apiData = newPriceDataResponse;
          }
        }
        if (!apiData.length) return;

        formulaResponseUiSync({
          row,
          column,
          newValue: cellData as Record<string, string>,
          apiData,
          sheetEditorRef,
        });

        return;
      }
    }
  };

  useEffect(() => {
    if (!enableLiveQuery || !sheetEditorRef) return;
    const interval = setInterval(() => {
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
    }, refreshRate);

    return () => clearInterval(interval);
  }, [enableLiveQuery]);
  return { handleLiveQuery, initialiseLiveQueryData };
};
