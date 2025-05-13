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
  initialTitle = 'Untitled',
  sheetEditorRef: externalSheetEditorRef,
  initialSheetData,
  setForceSheetRender,
}: Partial<DsheetProps>) => {
  const [loading, setLoading] = useState(true);
  const firstRender = useRef(true);
  // Use externally provided ref or create one internally
  const internalSheetEditorRef = useRef<WorkbookInstance | null>(null);
  const sheetEditorRef = externalSheetEditorRef || internalSheetEditorRef;
  const dataInitialized = useRef(false);
  const [title, setTitle] = useState(initialTitle);
  const titleRef = useRef(initialTitle);

  const { ydocRef, persistenceRef } = useYjsDocument(
    dsheetId,
    enableIndexeddbSync,
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

  // Function to handle title changes
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      titleRef.current = newTitle;

      // Store the title in YJS
      if (ydocRef.current) {
        const titleMap = ydocRef.current.getMap(`${dsheetId}-metadata`);
        titleMap.set('title', newTitle);

        // We no longer need to manually call onChange here
        // The title change will be detected by the metadata observer in useSheetData
      }
    },
    [dsheetId],
  );

  // Get initial title from YJS if available
  useEffect(() => {
    if (ydocRef.current && dsheetId) {
      const titleMap = ydocRef.current.getMap(`${dsheetId}-metadata`);
      titleMap.observe((event) => {
        if (event.keysChanged.has('title')) {
          const newTitle = titleMap.get('title') as string;
          setTitle(newTitle);
          titleRef.current = newTitle;
        }
      });

      // Set initial title if available in YJS
      if (titleMap.has('title')) {
        const storedTitle = titleMap.get('title') as string;
        setTitle(storedTitle);
        titleRef.current = storedTitle;
      } else {
        titleMap.set('title', initialTitle);
      }
    }
  }, [dsheetId, initialTitle]);

  // Handle initial data loading
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) return;

    const initializeWithDefaultData = () => {
      if (dataInitialized.current) return;

      const sheetArray = ydocRef.current?.getArray(dsheetId);
      const currentData = Array.from(sheetArray || []) as Sheet[];

      console.log('Initializing sheet data', {
        dsheetId,
        hasInitialData: initialSheetData && initialSheetData.length > 0,
        hasPersistedData: currentData.length > 0,
      });

      if (currentData.length === 0) {
        // No data in YJS storage
        const dataToUse =
          initialSheetData && initialSheetData.length > 0
            ? initialSheetData
            : DEFAULT_SHEET_DATA;

        console.log(
          'No persisted data found. Using initial data or default data.',
        );
        ydocRef.current?.transact(() => {
          sheetArray?.delete(0, sheetArray.length);
          sheetArray?.insert(0, dataToUse);
          currentDataRef.current = dataToUse;
        });
      } else {
        console.log('Using persisted data from IndexedDB:', currentData);
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
      initializeWithDefaultData();
    }

    return () => {
      dataInitialized.current = false;
    };
  }, [dsheetId, initialSheetData]);

  // Handle portal content updates
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current || !dsheetId) return;

    const newDoc = ydocRef.current;
    const uint8Array = toUint8Array(portalContent);
    Y.applyUpdate(newDoc, uint8Array);

    const map = newDoc.getArray(dsheetId);
    const newSheetData = Array.from(map) as Sheet[];

    // Update the current data reference
    currentDataRef.current = newSheetData;

    // Force a complete re-render of the component with the new data
    if (setForceSheetRender) {
      setForceSheetRender((prev) => prev + 1);
    }
  }, [portalContent, dsheetId]);

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
    title,
    handleTitleChange,
  };
};
