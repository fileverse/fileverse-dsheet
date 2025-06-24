import { useEffect, Dispatch, SetStateAction } from 'react';
import { Sheet } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { TEMPLATES_DATA } from '@fileverse-dev/dsheets-templates';

export const useApplyTemplatesBtn = ({
  selectedTemplate,
  ydocRef,
  dsheetId,
  currentDataRef,
  setForceSheetRender,
  sheetEditorRef,
  setDataBlockCalcFunction,
}: {
  selectedTemplate: string | undefined;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: Dispatch<SetStateAction<number>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  setDataBlockCalcFunction: React.Dispatch<React.SetStateAction<{ [key: string]: { [key: string]: any } }>>
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
      templateData[0].order = data.length;
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
      setDataBlockCalcFunction((prev) => {
        // let returnValue = [];

        // @ts-expect-error late
        if (Array.isArray(templateData[0]?.dataBlockCalcFunction)) {
          // @ts-expect-error late
          return { prev, [templateData[0]?.id]: templateData[0]?.dataBlockCalcFunction };
          // if (prev?.length > 0) {
          //   // @ts-expect-error later
          //   returnValue = [...prev, ...templateData[0].dataBlockCalcFunction];
          // } else {
          //   // @ts-expect-error later
          //   returnValue = [...templateData[0].dataBlockCalcFunction];
          // }
        }
        // else {
        //   returnValue = [];
        // }
        return prev;
      });
    }
  }, [selectedTemplate]);
};
