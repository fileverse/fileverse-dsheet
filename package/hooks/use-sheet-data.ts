import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { fromUint8Array } from 'js-base64';
import { Sheet } from '@fileverse-dev/fortune-core';

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
  onChange?: (fullUpdate: string, update: string) => void,
) => {
  const [sheetData, setSheetData] = useState<Sheet[] | null>(null);
  const currentDataRef = useRef<Sheet[] | null>(null);
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    if (!ydoc) return;

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      // 1. Get the encoded data
      const fullStateUpdate = Y.encodeStateAsUpdate(ydoc);
      const encodedUpdate = fromUint8Array(update);
      const encodedFullState = fromUint8Array(fullStateUpdate);

      // 2. Decode the update
      const decodedUpdate = Y.decodeUpdate(update);

      // Pass encoded data to consumer
      onChange?.(encodedFullState, encodedUpdate);

      if (origin === null) return;

      const newData = extractSheetDataFromUpdate(decodedUpdate);
      if (newData) {
        remoteUpdateRef.current = true;
        currentDataRef.current = newData;
        setSheetData(newData);
      }
    };

    ydoc.on('update', handleUpdate);
    return () => ydoc.off('update', handleUpdate);
  }, [ydoc, onChange, dsheetId]);

  return { sheetData, setSheetData, currentDataRef, remoteUpdateRef };
};
