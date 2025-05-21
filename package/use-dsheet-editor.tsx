import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';

import { useYjsDocument } from './hooks/use-yjs-document';
import { useWebRTCConnection } from './hooks/use-webrtc-connection';
import { useSheetData } from './hooks/use-sheet-data';
import { updateSheetData } from './utils/sheet-operations';
import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { DsheetProps } from './types';

export const useDsheetEditor = ({
  enableIndexeddbSync = true,
  dsheetId = '',
  onChange,
  username = 'Anonymous',
  enableWebrtc = true,
  portalContent,
  sheetEditorRef: externalSheetEditorRef,
  setForceSheetRender,
  isReadOnly = false,
}: Partial<DsheetProps>) => {
  const [loading, setLoading] = useState(true);
  const firstRender = useRef(true);
  // Use externally provided ref or create one internally
  const internalSheetEditorRef = useRef<WorkbookInstance | null>(null);
  const sheetEditorRef = externalSheetEditorRef || internalSheetEditorRef;
  const dataInitialized = useRef(false);

  const { ydocRef, persistenceRef } = useYjsDocument(
    dsheetId,
    enableIndexeddbSync,
    isReadOnly,
  );

  useWebRTCConnection(
    ydocRef.current,
    dsheetId,
    username,
    enableWebrtc,
    portalContent || '',
  );
  const { sheetData, setSheetData, currentDataRef, remoteUpdateRef } =
    useSheetData(ydocRef.current, dsheetId, onChange);

  // Handle initial data loading
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) return;

    const initializeWithDefaultData = () => {
      if (dataInitialized.current) return;

      const sheetArray = ydocRef.current?.getArray(dsheetId);
      const currentData = Array.from(sheetArray || []) as Sheet[];

      if (currentData.length === 0) {
        // No data in YJS storage
        let dataToUse: Sheet[];

        if (portalContent) {
          // If we have portal content, decode and use it
          const tempDoc = new Y.Doc();
          console.log('Initial loading: Created temp doc');
          try {
            const uint8Array = toUint8Array(portalContent);
            console.log(
              'Initial loading: Decoded portalContent to uint8Array:',
              uint8Array.length,
              'bytes',
            );
            Y.applyUpdate(tempDoc, uint8Array);
            const tempMap = tempDoc.getArray(dsheetId);
            console.log(
              'Initial loading: Got array from temp doc with dsheetId:',
              dsheetId,
            );
            dataToUse = Array.from(tempMap) as Sheet[];
            console.log('Initial loading: Extracted sheet data:', dataToUse);
            if (dataToUse.length === 0) {
              console.warn(
                'Initial loading: No data found in portalContent for dsheetId:',
                dsheetId,
              );
              dataToUse = DEFAULT_SHEET_DATA;
            }
          } catch (error) {
            console.error(
              'Initial loading: Error processing portalContent:',
              error,
            );
            dataToUse = DEFAULT_SHEET_DATA;
          } finally {
            tempDoc.destroy();
          }
        } else {
          // Use default data if no portal content available
          dataToUse = DEFAULT_SHEET_DATA;
        }

        if (!isReadOnly) {
          // Only persist data if not in read-only mode
          console.log(
            'No persisted data found. Persisting portal content or default data.',
          );
          ydocRef.current?.transact(() => {
            sheetArray?.delete(0, sheetArray.length);
            sheetArray?.insert(0, dataToUse);
          });
        } else {
          console.log(
            'Read-only mode: Using decoded portal content or default data.',
          );
        }
        // Set the current data reference regardless of read-only mode
        currentDataRef.current = dataToUse;
      } else {
        // Force set the current data ref
        currentDataRef.current = currentData;

        // Instead of manually updating UI, force a complete re-render
        // of the Workbook component with the new data
        if (setForceSheetRender) {
          setForceSheetRender((prev) => prev + 1);
        }
      }

      dataInitialized.current = true;
      setLoading(false);
    };

    if (persistenceRef.current) {
      // Wait for IndexedDB sync before initializing
      persistenceRef.current.once('synced', initializeWithDefaultData);
    } else {
      // No persistence, initialize immediately
      console.log('No persistence, initializing immediately');
      initializeWithDefaultData();
    }

    return () => {
      dataInitialized.current = false;
    };
  }, [dsheetId, isReadOnly, portalContent]);

  // Handle portal content updates
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current || !dsheetId) return;

    try {
      const newDoc = ydocRef.current;
      const uint8Array = toUint8Array(portalContent);
      console.log(
        'Portal content decoded to uint8Array:',
        uint8Array.length,
        'bytes',
      );

      // Create a temporary doc to decode the update without affecting the current doc
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, uint8Array);

      // Get the sheet data from temp doc to extract metadata
      const tempMap = tempDoc.getArray(dsheetId);
      const decodedSheetData = Array.from(tempMap) as Sheet[];
      console.log('Decoded sheet data from portal content:', decodedSheetData);

      // Now apply the update to the actual doc
      Y.applyUpdate(newDoc, uint8Array);
      const map = newDoc.getArray(dsheetId);
      const newSheetData = Array.from(map) as Sheet[];
      console.log('Updated sheet data in YDoc:', newSheetData);

      // Update the current data reference
      currentDataRef.current = newSheetData;
      console.log('Set currentDataRef.current to:', newSheetData);

      // Force a complete re-render of the component with the new data
      if (setForceSheetRender) {
        setForceSheetRender((prev) => prev + 1);
        console.log('Forced sheet re-render');
      }

      // If we're in read-only mode and have sheet data, ensure we use the correct sheet names
      if (isReadOnly && decodedSheetData.length > 0 && sheetEditorRef.current) {
        console.log('Read-only mode: Updating sheet names');
        // Update all sheet names from the decoded data
        if (currentDataRef.current) {
          // Create a new array with updated sheet names
          const updatedSheetData = currentDataRef.current.map(
            (sheet, index) => {
              if (decodedSheetData[index]) {
                return {
                  ...sheet,
                  name: decodedSheetData[index].name,
                };
              }
              return sheet;
            },
          );

          // Update the current data reference and trigger re-render
          currentDataRef.current = updatedSheetData;
          setSheetData([...updatedSheetData]);
          console.log(
            'Updated sheet data with correct names:',
            updatedSheetData,
          );
        }
      }
    } catch (error) {
      console.error('Error processing portal content:', error);
      console.error('Error details:', {
        portalContent: portalContent?.substring(0, 50) + '...',
        dsheetId,
        isReadOnly,
      });
    }
  }, [portalContent, dsheetId, isReadOnly]);

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

      updateSheetData(ydocRef.current, dsheetId, data, sheetEditorRef.current);
    },
    [dsheetId],
  );

  return {
    sheetEditorRef,
    handleChange,
    currentDataRef,
    sheetData,
    loading,
    ydocRef,
    setSheetData,
  };
};
