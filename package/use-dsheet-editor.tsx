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
          const uint8Array = toUint8Array(portalContent);
          Y.applyUpdate(tempDoc, uint8Array);
          const tempMap = tempDoc.getArray(dsheetId);
          dataToUse = Array.from(tempMap) as Sheet[];
          tempDoc.destroy();
        } else {
          dataToUse = DEFAULT_SHEET_DATA;
        }

        if (!isReadOnly) {
          ydocRef.current?.transact(() => {
            sheetArray?.delete(0, sheetArray.length);
            sheetArray?.insert(0, dataToUse);
          });
        }
        currentDataRef.current = dataToUse;
      } else {
        currentDataRef.current = currentData;

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

      // Create a temporary doc to decode the update without affecting the current doc
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, uint8Array);

      // Get the sheet data from temp doc to extract metadata
      const tempMap = tempDoc.getArray(dsheetId);
      const decodedSheetData = Array.from(tempMap) as Sheet[];

      // Now apply the update to the actual doc
      Y.applyUpdate(newDoc, uint8Array);
      const map = newDoc.getArray(dsheetId);
      const newSheetData = Array.from(map) as Sheet[];

      // Update the current data reference
      currentDataRef.current = newSheetData;

      // Force a complete re-render of the component with the new data
      if (setForceSheetRender) {
        setForceSheetRender((prev) => prev + 1);
      }

      // If we're in read-only mode and have sheet data, ensure we use the correct sheet names
      if (isReadOnly && decodedSheetData.length > 0 && sheetEditorRef.current) {
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
        }
      }
    } catch (error) {
      console.error('Error processing portal content:', error);
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
