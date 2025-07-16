import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { fromUint8Array } from 'js-base64';
import { Sheet } from '@fileverse-dev/fortune-react';
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

      // Create update data object
      const updateData: SheetUpdateData = {
        data: newData || currentDataRef.current || [],
      };

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

    // Subscribe to sheet data updates
    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
    };
  }, [ydoc, onChange, dsheetId]);

  return { sheetData, setSheetData, currentDataRef, remoteUpdateRef };
};
