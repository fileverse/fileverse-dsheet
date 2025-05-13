import { useState, useRef, useCallback, useEffect } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { toUint8Array } from 'js-base64';
import * as Y from 'yjs';

import { useYjsDocument } from './hooks/use-yjs-document';
import { useWebRTCConnection } from './hooks/use-webrtc-connection';
import { useSheetData } from './hooks/use-sheet-data';
import { updateSheetData } from './utils/sheet-operations';
import { updateSheetUIToYjs } from './utils/update-sheet-ui';
import { DEFAULT_SHEET_DATA } from './constants/shared-constants';
import { DsheetProps } from './types';

export const useDsheetEditor = ({
  enableIndexeddbSync = true,
  dsheetId = '',
  onChange,
  username = 'Anonymous',
  enableWebrtc = true,
  portalContent,
}: Partial<DsheetProps>) => {
  const [loading, setLoading] = useState(true);
  const firstRender = useRef(true);
  const sheetEditorRef = useRef<WorkbookInstance | null>(null);
  const dataInitialized = useRef(false);

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

  // Handle initial data loading
  useEffect(() => {
    if (!ydocRef.current || !dsheetId) return;

    const initializeWithDefaultData = () => {
      if (dataInitialized.current) return;

      const sheetArray = ydocRef.current?.getArray(dsheetId);
      const currentData = Array.from(sheetArray || []) as Sheet[];

      if (currentData.length === 0) {
        console.log('Initializing with default data');
        ydocRef.current?.transact(() => {
          sheetArray?.delete(0, sheetArray.length);
          sheetArray?.insert(0, DEFAULT_SHEET_DATA);
          currentDataRef.current = DEFAULT_SHEET_DATA;
        });
      } else {
        console.log('Using persisted data:', currentData);
        currentDataRef.current = currentData;
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
  }, [dsheetId]);

  // Handle portal content updates
  useEffect(() => {
    if (!portalContent?.length || !ydocRef.current || !dsheetId) return;

    const newDoc = ydocRef.current;
    const uint8Array = toUint8Array(portalContent);
    Y.applyUpdate(newDoc, uint8Array);

    const map = newDoc.getArray(dsheetId);
    const newSheetData = Array.from(map) as Sheet[];

    if (sheetEditorRef.current) {
      updateSheetUIToYjs({
        sheetEditorRef: sheetEditorRef.current,
        sheetData: newSheetData,
      });
    }

    currentDataRef.current = newSheetData;
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
  };
};
