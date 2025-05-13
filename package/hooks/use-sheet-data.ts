import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { fromUint8Array } from 'js-base64';
import { Sheet } from '@fileverse-dev/fortune-core';
import { SheetUpdateData } from '../types';

interface YjsStruct {
  content?: {
    arr?: unknown[];
    [key: string]: unknown;
  };
}

const extractSheetDataFromUpdate = (decodedUpdate: unknown) => {
  const update = decodedUpdate as { structs: YjsStruct[] };
  if (!update.structs) return null;

  for (const struct of update.structs) {
    if (
      struct.content &&
      'arr' in struct.content &&
      Array.isArray(struct.content.arr)
    ) {
      return struct.content.arr as Sheet[];
    }
  }
  return null;
};

export const useSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  onChange?: (updateData: SheetUpdateData, encodedUpdate?: string) => void,
) => {
  const [sheetData, setSheetData] = useState<Sheet[] | null>(null);
  const currentDataRef = useRef<Sheet[] | null>(null);
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    if (!ydoc) return;

    // Create a function to get a complete update with both sheet data and metadata
    const getCompleteUpdate = () => {
      // Generate a complete state update that includes everything
      const completeUpdate = Y.encodeStateAsUpdate(ydoc);
      return fromUint8Array(completeUpdate);
    };

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      // Extract the sheet data from the update
      const newData = extractSheetDataFromUpdate(Y.decodeUpdate(update));

      // Get title from metadata map
      const titleMap = ydoc.getMap(`${dsheetId}-metadata`);
      const title = titleMap.get('title') as string | undefined;

      // Create update data object
      const updateData: SheetUpdateData = {
        data: newData || currentDataRef.current || [],
      };

      if (title) {
        updateData.title = title;
      }

      // Get a complete encoded update that includes both sheet data and metadata
      const encodedCompleteUpdate = getCompleteUpdate();

      // Pass data to consumer
      onChange?.(updateData, encodedCompleteUpdate);

      if (origin === null) return;

      if (newData) {
        remoteUpdateRef.current = true;
        currentDataRef.current = newData;
        setSheetData(newData);
      }
    };

    // Handle metadata changes separately
    const handleMetadataChanges = () => {
      // Only trigger if we have sheet data
      if (!currentDataRef.current) return;

      const titleMap = ydoc.getMap(`${dsheetId}-metadata`);
      const title = titleMap.get('title') as string | undefined;

      const updateData: SheetUpdateData = {
        data: currentDataRef.current,
        title,
      };

      // Get a complete encoded update
      const encodedCompleteUpdate = getCompleteUpdate();

      // Notify consumer with the complete state
      onChange?.(updateData, encodedCompleteUpdate);
    };

    // Subscribe to sheet data updates
    ydoc.on('update', handleUpdate);

    // Subscribe to metadata updates
    const titleMap = ydoc.getMap(`${dsheetId}-metadata`);
    titleMap.observe(() => {
      handleMetadataChanges();
    });

    return () => {
      ydoc.off('update', handleUpdate);
      // No need to unsubscribe from titleMap observers as they're
      // automatically cleaned up when the document is destroyed
    };
  }, [ydoc, onChange, dsheetId]);

  return { sheetData, setSheetData, currentDataRef, remoteUpdateRef };
};
