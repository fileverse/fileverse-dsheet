import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';

import { CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';
import { updateSheetData } from '../utils/sheet-operations';
import { useLiveQuery } from './live-query/use-live-query';
import { DataBlockApiKeyHandlerType } from '../types';
// import { dataBlockCalcFunctionHandler } from '../utils/dataBlockCalcFunction';

/**
 * Hook for managing sheet data
 * Handles initialization, updates, and persistence of sheet data
 */
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
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } },
  setDataBlockCalcFunction?: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >,
  enableLiveQuery = false,
  liveQueryRefreshRate?: number,
  dataBlockApiKeyHandler?: DataBlockApiKeyHandlerType,
  allowComments?: boolean
) => {

  const [sheetData, setSheetData] = useState<Sheet[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const currentDataRef = useRef<Sheet[]>([]);
  const remoteUpdateRef = useRef<boolean>(false);
  const dataInitialized = useRef<boolean>(false);
  const firstRender = useRef<boolean>(true);
  const isUpdatingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  const portalContentProcessed = useRef<boolean>(false);

  const { handleLiveQuery, initialiseLiveQueryData } = useLiveQuery(
    sheetEditorRef,
    dataBlockApiKeyHandler,
    enableLiveQuery,
    liveQueryRefreshRate,
  );

  // Apply portal content if provided (do this before any other initialization)
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current || !dsheetId) {
      return;
    }

    try {
      const uint8Array = toUint8Array(portalContent);

      // Create a temporary doc to decode the update.
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, uint8Array);

      // Get the sheet data from temp doc to extract metadata
      const tempMap = tempDoc.getArray(dsheetId);
      const decodedSheetData = Array.from(tempMap) as Sheet[];

      if (decodedSheetData.length > 0) {
        // Merge the portal content into the main YJS document
        Y.applyUpdate(ydocRef.current, uint8Array);

        const map = ydocRef.current.getArray(dsheetId);

        const newSheetData = Array.from(map) as Sheet[];

        // Update the current data reference
        currentDataRef.current = newSheetData;
        initialiseLiveQueryData(newSheetData);

        // Always mark portal content as processed
        portalContentProcessed.current = true;

        // Force a re-render with the portal content data
        if (setForceSheetRender) {
          setForceSheetRender((prev) => prev + 1);
        }
      }

      tempDoc.destroy();
    } catch (error) {
      console.error('[DSheet] Error processing portal content:', error);
    }
  }, [portalContent]);

  // Apply comment data if provided (do this before any other initialization)
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) {
      return;
    }

    try {
      const currentDocData = ydocRef.current.getArray(dsheetId);
      const currentData = Array.from(currentDocData) as Sheet[];
      if (currentData.length > 0) {
        const setContext = sheetEditorRef?.current?.getWorkbookSetContext();
        if (setContext) {
          setContext?.((ctx: any) => {
            const files = ctx.luckysheetfile;
            files.forEach((file: any, fileIndex: number) => {
              file.celldata?.forEach((cell: any) => {
                // @ts-expect-error later
                const comment = commentData[`${fileIndex}_${cell.r}_${cell.c}`];
                if (comment) {
                  cell.v = {
                    ...cell.v,
                    ps: !allowComments ? undefined : CELL_COMMENT_DEFAULT_VALUE,
                  };
                } else {
                  cell.v = {
                    ...cell.v,
                    ps: undefined,
                  };
                }
              })
            })
          })
        } else {
          currentData.forEach((sheet, index) => {
            const sheetCellData = sheet.celldata;
            sheetCellData?.forEach((cell) => {
              // @ts-expect-error later
              const comment = commentData[`${index}_${cell.r}_${cell.c}`];
              if (comment) {
                if (cell.v) {
                  cell.v = {
                    ...cell.v,
                    ps: !allowComments ? undefined : CELL_COMMENT_DEFAULT_VALUE,
                  };
                }
              } else {
                if (cell.v) {
                  cell.v = {
                    ...cell.v,
                    ps: undefined,
                  };
                }
              }
            });
          });
        }

        currentDataRef.current = currentData;
      }
    } catch (error) {
      console.error('[DSheet] Error processing comment data:', error);
    }
  }, [commentData, dsheetId, ydocRef, isReadOnly, isDataLoaded, portalContent, allowComments]);

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
        currentDataRef.current = currentData;
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
      const newData = Array.from(sheetArray) as Sheet[];
      currentDataRef.current = newData;

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
      if (firstRender.current) {
        const cachedDataBlockCalcFunction: {
          [key: string]: { [key: string]: any };
        } = {};
        data.map((sheet) => {
          if (Array.isArray(sheet.dataBlockCalcFunction)) {
            const newDataBlockCalcFunction: {
              [key: string]: { [key: string]: any };
            } = {};
            sheet.dataBlockCalcFunction.map((dataBlockCalc) => {
              newDataBlockCalcFunction[
                dataBlockCalc.row + '_' + dataBlockCalc.column
              ] = dataBlockCalc;
            });
            cachedDataBlockCalcFunction[sheet.id as string] = {
              ...newDataBlockCalcFunction,
            };
          } else {
            if (!sheet.dataBlockCalcFunction) return;
            // @ts-expect-error later
            cachedDataBlockCalcFunction[sheet.id] = sheet.dataBlockCalcFunction;
          }
        });
        setDataBlockCalcFunction?.(cachedDataBlockCalcFunction);
        /*Here we are calling dataBlockCalcFunctionHandler to update the sheet UI with latest data. Comment it for now, will decide to remove later*/
        // setTimeout(() => {
        //   // @ts-expect-error later
        //   dataBlockCalcFunctionHandler({ dataBlockCalcFunction: cachedDataBlockCalcFunction, sheetEditorRef });
        // }, 1000)

        firstRender.current = false;
        return;
      }
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
      );

      // Reset the flag after a short delay to allow the update to complete
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 50);

      // Call external onChange handler if provided
      if (onChange) {
        onChange(data);
      }
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
