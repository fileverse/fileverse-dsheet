import { useEffect, Dispatch, SetStateAction } from 'react';
import { Sheet } from '@fortune-sheet/core';
import { WorkbookInstance } from '@fortune-sheet/react';
import * as Y from 'yjs';
import { TEMPLATES_DATA } from '@fileverse-dev/dsheets-templates';

export const useApplyTemplatesBtn = ({
  selectedTemplate,
  ydocRef,
  dsheetId,
  currentDataRef,
  setForceSheetRender,
  sheetEditorRef,
}: {
  selectedTemplate: string | undefined;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: Dispatch<SetStateAction<number>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
}) => {
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!ydocRef.current) return;
    const sheetArray = ydocRef.current.getArray(dsheetId);
    const templateData: Sheet[] = TEMPLATES_DATA[
      selectedTemplate as string
    ] as Sheet[];
    if (templateData) {
      const data = Array.from(sheetArray) as Sheet[];
      const finalData = [...data, ...templateData];
      ydocRef.current.transact(() => {
        sheetArray.delete(0, sheetArray.length);
        sheetArray.insert(0, finalData);
        currentDataRef.current = finalData;
      });
      setForceSheetRender?.((prev: number) => prev + 1);
      setTimeout(() => {
        sheetEditorRef.current?.activateSheet({
          index: finalData.length - 1,
        });
      }, 100);
    }
  }, [selectedTemplate]);
};
