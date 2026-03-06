import { useEffect, Dispatch, SetStateAction } from 'react';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import * as Y from 'yjs';
import { TEMPLATES_DATA } from '@fileverse-dev/dsheets-templates';
import { migrateSheetFactoryForImport } from '../utils/migrate-new-yjs';
import { ySheetArrayToPlain } from '../utils/update-ydoc';

export const useApplyTemplatesBtn = ({
  selectedTemplate,
  ydocRef,
  dsheetId,
  currentDataRef,
  setForceSheetRender,
  sheetEditorRef,
  setDataBlockCalcFunction,
  initialiseLiveQueryData,
}: {
  selectedTemplate: string | undefined;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  currentDataRef: React.MutableRefObject<object | null>;
  setForceSheetRender: Dispatch<SetStateAction<number>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  setDataBlockCalcFunction: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >;
  initialiseLiveQueryData: (sheets: Sheet[]) => void;
}) => {
  useEffect(() => {
    if (!selectedTemplate) return;
    if (!ydocRef.current) return;
    const sheetArray = ydocRef.current.getArray(dsheetId);
    const templateData: Sheet[] = TEMPLATES_DATA[
      selectedTemplate as string
    ] as Sheet[];
    if (templateData) {
      const newSheetId = sheetEditorRef.current
        ?.getSettings()
        .generateSheetId();
      const data = Array.from(sheetArray) as Sheet[];
      templateData[0].order = data.length;
      if (!templateData[0].id) {
        templateData[0].id = newSheetId;
      }
      const finalData = [...data, ...templateData];
      ydocRef.current.transact(() => {
        finalData.forEach((sheet) => {
          if (sheet instanceof Y.Map) return;

          const factory = migrateSheetFactoryForImport(sheet);
          sheetArray.push([factory()]);
        });
      });
      const plainData = ySheetArrayToPlain(sheetArray);
      currentDataRef.current = plainData;
      initialiseLiveQueryData(plainData);
      setForceSheetRender?.((prev: number) => prev + 1);
      setTimeout(() => {
        sheetEditorRef.current?.activateSheet({
          index: plainData.length - 1,
        });
      }, 100);
      setDataBlockCalcFunction((prev) => {
        if (templateData[0]?.dataBlockCalcFunction) {
          // @ts-expect-error late
          return { prev, [newSheetId]: templateData[0]?.dataBlockCalcFunction };
        }
        return prev;
      });
    }
  }, [selectedTemplate]);
};
