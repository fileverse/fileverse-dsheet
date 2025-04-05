import { useState, useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { handleFileUploadUtil } from './utils/handleFileImport';
import { DEFAULT_SHEET_DATA } from './constant/shared-constant';

import { Sheet } from '@fortune-sheet/core';
import { WorkbookInstance } from '@fortune-sheet/react';

import { DsheetProp } from './types';

export const useDsheetEditor = ({
  initialSheetData,
  //For will remove later on, testing sync
  enableIndexeddbSync = true,
  dsheetId = 'test',
}: Partial<DsheetProp>) => {
  const [loading, setLoading] = useState(true);
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const currentDataRef = useRef<Sheet[] | null>(null);
  const sheetEditorRef = useRef<WorkbookInstance>(null);
  const [sheetData, setSheetData] = useState<Sheet[] | null>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const fileSheetdata = await handleFileUploadUtil(event);
    setSheetData(fileSheetdata);
  };

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    if (enableIndexeddbSync && dsheetId) {
      const persistence = new IndexeddbPersistence(dsheetId, ydoc);
      persistenceRef.current = persistence;
      persistence.on('synced', () => {
        const sheetArray = ydoc.getArray('SheetData');
        if (sheetArray && sheetArray.length > 0) {
          const data = Array.from(sheetArray) as Sheet[];
          currentDataRef.current = data;
        } else {
          initializeWithDefaultData(ydoc);
        }
        setLoading(false);
      });

      function initializeWithDefaultData(ydoc: Y.Doc) {
        const sheetArray = ydoc.getArray('SheetData');
        sheetArray.delete(0, sheetArray.length);
        sheetArray.insert(0, DEFAULT_SHEET_DATA);
        currentDataRef.current = DEFAULT_SHEET_DATA;
      }
    } else {
      const newSheetData = initialSheetData || DEFAULT_SHEET_DATA;
      const sheetArray = ydoc.getArray('SheetData');
      sheetArray.delete(0, sheetArray.length);
      sheetArray.insert(0, newSheetData);
      currentDataRef.current = newSheetData;
      setLoading(false);
    }

    return () => {
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
      }
    };
  }, []);

  const handleChange = (data: Sheet[]) => {
    if (ydocRef.current) {
      const ydoc = ydocRef.current;
      const sheetArray = ydoc.getArray('SheetData');
      // Compare data with current array content
      // const currentArray = Array.from(sheetArray);
      //if (JSON.stringify(currentArray) !== JSON.stringify(data)) {

      // This need better diffing algorithm for better performance with large datasets
      // For this simplified version, we'll still replace the array
      // but we only do it when there's an actual change
      const sheetFormatCellData = data.map((sheet: Sheet) => {
        const sheetCellData = sheet['data'];
        if (!sheetCellData) {
          return sheet;
        }
        const transformedData = sheetCellData.flatMap((row, rowIndex) =>
          row.map((cellValue, colIndex) => ({
            r: rowIndex,
            c: colIndex,
            v: cellValue,
          })),
        );
        const newSheetdata = { ...sheet, celldata: transformedData };
        delete newSheetdata.data;
        return newSheetdata;
      });
      sheetArray.delete(0, sheetArray.length);
      sheetArray.insert(0, sheetFormatCellData);
      currentDataRef.current = sheetFormatCellData;
      //}
    }
  };

  return {
    sheetEditorRef,
    handleChange,
    currentDataRef,
    sheetData,
    loading,
    setSheetData,
    handleFileUpload,
  };
};
