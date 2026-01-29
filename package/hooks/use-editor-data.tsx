import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';
// import {
//   CELL_COMMENT_DEFAULT_VALUE,
//   // DEFAULT_SHEET_DATA 
// } from '../constants/shared-constants';
// @ts-ignore
import { updateSheetData } from '../utils/sheet-operations';
import { useLiveQuery } from './live-query/use-live-query';
import { DataBlockApiKeyHandlerType } from '../types';
import { ySheetArrayToPlain } from '../utils/update-ydoc';
// import { dataBlockCalcFunctionHandler } from '../utils/dataBlockCalcFunction';

/**
 * Hook for managing sheet data
 * Handles initialization, updates, and persistence of sheet data
 */

function normalizeCelldataArray(
  celldata: any[],
): Record<string, any> {
  const result: Record<string, any> = {};

  celldata.forEach((cell) => {
    if (
      typeof cell?.r === 'number' &&
      typeof cell?.c === 'number'
    ) {
      const key = `${cell.r}_${cell.c}`;
      result[key] = cell;
    }
  });

  return result;
}

function migrateSheetArrayIfNeeded(
  ydoc: Y.Doc,
  sheetArray: Y.Array<any>,
) {
  let needsMigration = false;

  sheetArray.forEach((item) => {
    if (!(item instanceof Y.Map)) {
      needsMigration = true;
    }
  });

  console.log('needsMigration ****', needsMigration, sheetArray);

  if (!needsMigration) return;

  ydoc.transact(() => {
    sheetArray.forEach((item, index) => {
      if (item instanceof Y.Map) return;

      const sheetMap = new Y.Map();

      Object.entries(item).forEach(([key, value]) => {
        console.log('key [[[[[[[[[[[[[[', key, 'value', value,);
        // ✅ SPECIAL: celldata array → Y.Map keyed by r_c
        if (key === 'celldata' && Array.isArray(value)) {
          const cellMap = new Y.Map();
          const normalized = normalizeCelldataArray(value);

          Object.entries(normalized).forEach(
            ([cellKey, cellValue]) => {
              cellMap.set(cellKey, cellValue);
            },
          );

          sheetMap.set('celldata', cellMap);
          return;
        }
        if (key === 'calcChain' && Array.isArray(value)) {
          const calcChainMap = new Y.Map();
          const normalized = normalizeCelldataArray(value);

          Object.entries(normalized).forEach(
            ([cellKey, cellValue]) => {
              calcChainMap.set(cellKey, cellValue);
            },
          );

          sheetMap.set('calcChain', calcChainMap);
          return;
        }

        if (key === 'luckysheet_conditionformat_save' && Array.isArray(value)) {
          const luckysheet_conditionformat_save = new Y.Array();
          value.forEach((item) => {
            luckysheet_conditionformat_save.push([item]); // 👈 wrap in array
          });

          sheetMap.set(
            'luckysheet_conditionformat_save',
            luckysheet_conditionformat_save
          );
          return;
        }

        if (key === 'dataBlockCalcFunction') {
          const dataBlockCalcFunction = new Y.Map();
          Object.entries(value as object).forEach(([k, v]) =>
            dataBlockCalcFunction.set(k, v),
          );
          sheetMap.set('dataBlockCalcFunction', dataBlockCalcFunction);
          return;
        }

        if (key === 'dataVerification') {
          const dataVerification = new Y.Map();
          const dV = value ? value : {};
          Object.entries(dV as object).forEach(([k, v]) =>
            dataVerification.set(k, v),
          );
          sheetMap.set('dataVerification', dataVerification);
          return;
        }

        if (key === 'hyperlink') {
          const hyperlink = new Y.Map();
          const hL = value ? value : {};
          Object.entries(hL as object).forEach(([k, v]) =>
            hyperlink.set(k, v),
          );
          sheetMap.set('hyperlink', hyperlink);
          return;
        }

        if (key === 'conditionRules') {
          const conditionRules = new Y.Map();
          const cR = value ? value : {};
          Object.entries(cR as object).forEach(([k, v]) =>
            conditionRules.set(k, v),
          );
          sheetMap.set('conditionRules', conditionRules);
          return;
        }

        if (key === 'config') {
          // const config = new Y.Map();
          // const cR = value ? value : {};
          // Object.entries(cR as object).forEach(([k, v]) =>
          //   config.set(k, v),
          // );
          sheetMap.set('config', value);
          return
        }

        // nested object → Y.Map
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          const yMap = new Y.Map();
          Object.entries(value).forEach(([k, v]) =>
            yMap.set(k, v),
          );
          sheetMap.set(key, yMap);
          return;
        }

        // primitives
        sheetMap.set(key, value);
      });

      sheetArray.delete(index, 1);
      sheetArray.insert(index, [sheetMap]);
    });
  });
}

export const useEditorData = (
  ydocRef: React.MutableRefObject<Y.Doc | null>,
  dsheetId: string,
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
  setForceSheetRender?: React.Dispatch<React.SetStateAction<number>>,
  portalContent?: string,
  isReadOnly = false,
  onChange?: (data: Sheet[]) => void,
  syncStatus?: 'initializing' | 'syncing' | 'synced' | 'error',
  commentData?: object,
  // @ts-ignore
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } },
  setDataBlockCalcFunction?: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >,
  enableLiveQuery = false,
  liveQueryRefreshRate?: number,
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType,
  allowComments?: boolean
) => {
  console.log('useEditorData', commentData, allowComments);
  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const currentDataRef = useRef<Sheet[]>([]);
  const remoteUpdateRef = useRef<boolean>(false);
  const dataInitialized = useRef<boolean>(false);
  const firstRender = useRef<boolean>(true);
  const isUpdatingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  const portalContentProcessed = useRef<boolean>(false);
  console.log('isReadOnly', currentDataRef, firstRender, sheetEditorRef.current?.getAllSheets());
  // if (!firstRender.current) {
  //   currentDataRef.current = sheetEditorRef.current?.getAllSheets() as Sheet[];
  // }

  const { handleLiveQuery, initialiseLiveQueryData } = useLiveQuery(
    sheetEditorRef,
    dataBlockApiKeyHandler,
    enableLiveQuery,
    liveQueryRefreshRate,
  );

  // Apply portal content if provided (do this before any other initialization)
  useEffect(() => {
    console.log('portalContent important', currentDataRef, portalContentProcessed, portalContent, "wewe");
    if (!portalContent?.length || !ydocRef.current || !dsheetId || portalContentProcessed.current) {
      return;
    }

    try {
      const uint8Array = toUint8Array(portalContent);

      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, uint8Array);

      // Merge into main doc
      Y.applyUpdate(ydocRef.current, uint8Array);

      const sheetArray =
        ydocRef.current.getArray(dsheetId);
      console.log('sheetArray before calling migrate', sheetArray, Array.from(sheetArray), sheetArray.length);


      // ✅ FULL migration (including celldata)
      migrateSheetArrayIfNeeded(
        ydocRef.current,
        sheetArray,
      );

      console.log('sheetArray after calling migrate', sheetArray);
      // ✅ Convert to plain snapshot for spreadsheet
      const newSheetData =
        ySheetArrayToPlain(
          // @ts-ignore
          sheetArray as Y.Array<Y.Map>,
        );

      console.log('newSheetData after calling migrate for UI', newSheetData);

      currentDataRef.current = newSheetData;
      initialiseLiveQueryData(newSheetData);

      portalContentProcessed.current = true;

      if (setForceSheetRender) {
        setForceSheetRender((prev) => prev + 1);
      }

      const dataBlockList: { [key: string]: any } = {};
      newSheetData.forEach((sheet: Sheet) => {
        if (sheet?.id && sheet?.dataBlockCalcFunction) {
          dataBlockList[sheet.id] = {
            ...sheet.dataBlockCalcFunction,
          };
        }
      });
      console.log('dataBlockList', dataBlockList);
      //@ts-ignore
      setDataBlockCalcFunction?.(dataBlockList);

      tempDoc.destroy();
    } catch (error) {
      console.error(
        '[DSheet] Error processing portal content:',
        error,
      );
    }
  }, [portalContent]);


  // Apply comment data if provided (do this before any other initialization)
  // useEffect(() => {
  //   if (!ydocRef.current || !dsheetId) {
  //     return;
  //   }
  //   try {
  //     const currentDocData = ydocRef.current.getArray(dsheetId);
  //     const currentData = Array.from(currentDocData) as Sheet[];
  //     if (currentData.length > 0 && syncStatus === 'synced') {
  //       const setContext = sheetEditorRef?.current?.getWorkbookSetContext();
  //       if (sheetEditorRef.current !== null && setContext) {
  //         setContext?.((ctx: any) => {
  //           const files = ctx.luckysheetfile;
  //           files.forEach((file: any, fileIndex: number) => {
  //             file.data?.forEach((row: any, rowIndex: number) => {
  //               row.forEach((cell: any, colIndex: number) => {
  //                 if (cell) {
  //                   // @ts-expect-error later
  //                   const comment = commentData[`${fileIndex}_${rowIndex}_${colIndex}`];
  //                   if (comment) {
  //                     cell.ps = allowComments ? CELL_COMMENT_DEFAULT_VALUE : undefined;
  //                   } else {
  //                     cell.ps = undefined
  //                   }
  //                 }
  //               })
  //             })
  //           })
  //         });
  //       }
  //       //handle if data is synced but editor is not rendered/loaded. Usally happens on when allowComments is false on viewerside
  //       if (sheetEditorRef.current === null && syncStatus === 'synced') {
  //         currentData.forEach((sheet, index) => {
  //           const sheetCellData = sheet.celldata;
  //           sheetCellData?.forEach((cell) => {
  //             // @ts-expect-error later
  //             const comment = commentData[`${index}_${cell.r}_${cell.c}`];
  //             if (comment) {
  //               if (cell.v) {
  //                 cell.v = {
  //                   ...cell.v,
  //                   ps: !allowComments ? undefined : CELL_COMMENT_DEFAULT_VALUE,
  //                 };
  //               }
  //             } else {
  //               if (cell.v) {
  //                 cell.v = {
  //                   ...cell.v,
  //                   ps: undefined,
  //                 };
  //               }
  //             }
  //           });
  //         });
  //       }
  //       //currentDataRef.current = currentData;
  //     }
  //   } catch (error) {
  //     console.error('[DSheet] Error processing comment data:', error);
  //   }
  // }, [commentData, dsheetId, ydocRef, isReadOnly, isDataLoaded, portalContent, allowComments, syncStatus]);

  // Initialize sheet data AFTER sync is complete - BUT ONLY IF NOT IN READ-ONLY MODE or if we have no data yet
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) {
      return;
    }

    // Only proceed with initialization if we've synced
    if (syncStatus === 'synced') {
      const initializeWithDefaultData = () => {
        // If we've already initialized (either here or via portal content), don't do it again
        if (dataInitialized.current) {
          return;
        }

        const sheetArray = ydocRef.current?.getArray(dsheetId);
        const currentData = Array.from(sheetArray || []) as Sheet[];
        //currentDataRef.current = currentData;
        initialiseLiveQueryData(currentData);

        dataInitialized.current = true;
        setIsDataLoaded(true);
      };

      initializeWithDefaultData();
    }
  }, [dsheetId, isReadOnly, syncStatus]);

  // Attach listener for YJS data changes
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) return;
    const sheetArray = ydocRef.current.getArray(dsheetId);

    // Update local state when YJS array changes
    const observerCallback = () => {
      // Skip updates if we're in the middle of updating YJS ourselves
      // This prevents flickering when the update comes from the local user
      if (isUpdatingRef.current) {
        return;
      }

      remoteUpdateRef.current = true;
      //const newData = Array.from(sheetArray) as Sheet[];
      //currentDataRef.current = newData;

      // Debounce the re-render to prevent multiple quick updates
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        if (setForceSheetRender) {
          setForceSheetRender((prev) => prev + 1);
        }
        debounceTimerRef.current = null;
      }, 50); // 50ms debounce
    };

    sheetArray.observe(observerCallback);

    return () => {
      sheetArray.unobserve(observerCallback);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [ydocRef, dsheetId]);

  // Handle changes to the sheet
  const handleChange = useCallback(
    (data: Sheet[]) => {
      console.log('data whyyy', data);
      // if (firstRender.current) {
      //   const cachedDataBlockCalcFunction: {
      //     [key: string]: { [key: string]: any };
      //   } = {};
      //   data.map((sheet) => {
      //     if (Array.isArray(sheet.dataBlockCalcFunction)) {
      //       const newDataBlockCalcFunction: {
      //         [key: string]: { [key: string]: any };
      //       } = {};
      //       sheet.dataBlockCalcFunction.map((dataBlockCalc) => {
      //         newDataBlockCalcFunction[
      //           dataBlockCalc.row + '_' + dataBlockCalc.column
      //         ] = dataBlockCalc;
      //       });
      //       cachedDataBlockCalcFunction[sheet.id as string] = {
      //         ...newDataBlockCalcFunction,
      //       };
      //     } else {
      //       if (!sheet.dataBlockCalcFunction) return;
      //       // @ts-expect-error later
      //       cachedDataBlockCalcFunction[sheet.id] = sheet.dataBlockCalcFunction;
      //     }
      //   });
      //   setDataBlockCalcFunction?.(cachedDataBlockCalcFunction);
      //   /*Here we are calling dataBlockCalcFunctionHandler to update the sheet UI with latest data. Comment it for now, will decide to remove later*/
      //   // setTimeout(() => {
      //   //   // @ts-expect-error later
      //   //   dataBlockCalcFunctionHandler({ dataBlockCalcFunction: cachedDataBlockCalcFunction, sheetEditorRef });
      //   // }, 1000)

      //   firstRender.current = false;
      //   return;
      // }
      if (remoteUpdateRef.current) {
        remoteUpdateRef.current = false;
        return;
      }

      // Set the flag to indicate we're in the process of updating YJS
      isUpdatingRef.current = true;
      updateSheetData(
        ydocRef.current,
        dsheetId,
        data,
        sheetEditorRef.current,
        dataBlockCalcFunction,
        isReadOnly,
        onChange,
      );

      // Reset the flag after a short delay to allow the update to complete
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);

      // Call external onChange handler if provided
      // if (onChange) {
      //   onChange(data);
      // }
    },
    [dsheetId, onChange],
  );

  return {
    sheetData,
    setSheetData,
    currentDataRef,
    remoteUpdateRef,
    isDataLoaded,
    handleChange,
    handleLiveQuery,
    initialiseLiveQueryData,
  };
};
