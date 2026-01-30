import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { updateYdocSheetData, ySheetArrayToPlain } from './update-ydoc';
import * as Y from 'yjs';
import { diffObjectMap } from './diff-sheet';
// import { fromUint8Array } from 'js-base64';

type SheetChangePath = {
  sheetId: string;
  path: string[];        // ['name'], ['config', 'merge'], ['celldata']
  key?: string;          // 👈 only for celldata
  value: any;
  type?: 'update' | 'delete';
};


/**
 * Verifies the integrity of sheet data in a YDoc against a given sheet editor instance.
 * This function is used to verify that the sheet data in a YDoc matches the data in a sheet editor instance.
 * @param {Object} options
 * @param {React.RefObject<WorkbookInstance | null>} options.sheetEditorRef - Reference to the sheet editor instance
 * @param {React.RefObject<Y.Doc | null>} options.ydocRef - Reference to the YDoc instance
 * @returns {void}
 */
export const dataBlockListYdocUpdate = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleContentPortal,
  dataBlockCalcFunction
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  handleContentPortal?: any,
  dataBlockCalcFunction?: any
}
) => {
  console.log('dataBlockListYdocUpdate', sheetEditorRef, ydocRef, handleContentPortal, updateYdocSheetData);
  if (!sheetEditorRef.current || !ydocRef.current) return;
  const currentSheetId: string = sheetEditorRef.current?.getWorkbookContext()
    ?.currentSheetId as string;
  let newDataB = dataBlockCalcFunction?.[currentSheetId as string] || {};
  let oldSheets = ydocRef.current?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)
  let oldDataB = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.dataBlockCalcFunction || {};

  //@ts-ignore
  const diffDataBlock = diffObjectMap(oldDataB, newDataB)
  const changes: SheetChangePath[] = []
  console.log('diffDataVerification', diffDataBlock, plainOldSheets, newDataB, oldDataB);
  Object.keys(diffDataBlock.added).forEach((key) => {
    const item = diffDataBlock.added[key]
    changes.push({
      sheetId: currentSheetId, path: ['dataBlockCalcFunction'], value: item, key: key,
      type: 'update',
    })
  });

  Object.keys(diffDataBlock.removed).forEach((key) => {
    const item = diffDataBlock.removed[key];
    changes.push({
      sheetId: currentSheetId, path: ['dataBlockCalcFunction'], value: item, key: key,
      type: 'delete',
    })
  });
  if (changes.length > 0) {
    updateYdocSheetData(
      // @ts-ignore
      ydocRef.current,
      // @ts-ignore
      dsheetId,
      sheetEditorRef.current,
      changes,
      // @ts-ignore
      handleContentPortal,
    );
  }


}