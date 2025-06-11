import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { CellWithRowAndCol } from '@fileverse-dev/fortune-core';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';

import { DEFAULT_SHEET_DATA, CELL_COMMENT_DEFAULT_VALUE } from '../constants/shared-constants';
import { updateSheetData } from '../utils/sheet-operations';

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
  const commentDataProcessed = useRef<boolean>(false);

  // Apply portal content if provided (do this before any other initialization)
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current || !dsheetId) {
      return;
    }

    try {
      const newDoc = ydocRef.current;
      const uint8Array = toUint8Array(portalContent);

      // Create a temporary doc to decode the update without affecting the current doc
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, uint8Array);

      // Get the sheet data from temp doc to extract metadata
      const tempMap = tempDoc.getArray(dsheetId);
      const decodedSheetData = Array.from(tempMap) as Sheet[];

      // Only proceed if we have valid data in the portal content
      if (decodedSheetData.length > 0) {
        // Apply the update to the actual doc
        Y.applyUpdate(newDoc, uint8Array);
        const map = newDoc.getArray(dsheetId);
        const newSheetData = Array.from(map) as Sheet[];

        // Update the current data reference
        currentDataRef.current = newSheetData;

        // Mark data as initialized since we've loaded from portal content
        dataInitialized.current = true;
        setIsDataLoaded(true);

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
  }, [portalContent, dsheetId, ydocRef, isReadOnly]);

  // Apply comment data if provided (do this before any other initialization)
  useEffect(() => {
    if (!commentData || !ydocRef.current || !dsheetId) {
      return;
    }

    try {
      const currentDocData = ydocRef.current.getArray(dsheetId);
      const currentData = Array.from(currentDocData) as Sheet[];
      if (currentData.length > 0 && commentData && !commentDataProcessed.current) {
        currentData.forEach((sheet) => {
          const sheetCellData = sheet.celldata;
          sheetCellData?.forEach((cell: CellWithRowAndCol) => {
            // @ts-expect-error later
            const comment = commentData[`${cell.r}_${cell.c}`];
            if (comment && comment.sheetId === sheet.id) {
              if (cell.v) {
                cell.v = {
                  ...cell.v,
                  ps: CELL_COMMENT_DEFAULT_VALUE
                }
              }
            } else {
              if (cell.v) {
                cell.v = {
                  ...cell.v,
                  ps: undefined
                }
              }
            }
          })
        });
        commentDataProcessed.current = true;
      }
    } catch (error) {
      console.error('[DSheet] Error processing comment data:', error);
    }
  }, [commentData, dsheetId, ydocRef, isReadOnly, isDataLoaded]);

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

        // In read-only mode with no existing data and no portal content, we still need some data
        // to render something, but we'll just set the current ref without modifying YJS
        if (currentData.length === 0) {
          if (isReadOnly) {
            // In read-only mode, we'll still mark as loaded without creating data in YJS
            setIsDataLoaded(true);

            // For read-only mode, we'll let the EditorWorkbook component handle rendering a temp sheet
            // Don't set currentDataRef to an empty array as it could cause rendering issues
            if (!portalContentProcessed.current) {
              // Keep currentDataRef as is, EditorWorkbook will handle empty data
            }
          } else {
            // No data in YJS storage, use default data
            const dataToUse = DEFAULT_SHEET_DATA;

            ydocRef.current?.transact(() => {
              sheetArray?.delete(0, sheetArray.length);
              sheetArray?.insert(0, dataToUse);
            });

            currentDataRef.current = dataToUse;
          }
        } else {
          currentDataRef.current = currentData;

          if (setForceSheetRender) {
            setForceSheetRender((prev) => prev + 1);
          }
        }

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
        firstRender.current = false;
        return;
      }
      if (remoteUpdateRef.current) {
        remoteUpdateRef.current = false;
        return;
      }

      // Set the flag to indicate we're in the process of updating YJS
      isUpdatingRef.current = true;
      updateSheetData(ydocRef.current, dsheetId, data, sheetEditorRef.current);

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
  };
};
