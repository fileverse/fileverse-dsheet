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
export const dataVerificationYdocUpdate = ({
  sheetEditorRef,
  ydocRef,
  dsheetId,
  handleContentPortal
}: {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  ydocRef: React.RefObject<Y.Doc | null>;
  dsheetId: string;
  handleContentPortal?: any
}
) => {
  console.log('dataVerificationYdocUpdate getting called');
  console.log('dataVerificationYdocUpdate', sheetEditorRef, ydocRef, handleContentPortal, updateYdocSheetData);
  if (!sheetEditorRef.current || !ydocRef.current) return;
  const currentSheetId: string = sheetEditorRef.current?.getWorkbookContext()
    ?.currentSheetId as string;
  let newDataV = sheetEditorRef.current?.getSheet()?.dataVerification || {};
  let oldSheets = ydocRef.current?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)
  let oldDataV = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.dataVerification || {};

  //@ts-ignore
  const diffDataVerification = diffObjectMap(oldDataV, newDataV);
  const changes: SheetChangePath[] = []
  console.log('diffDataVerification', diffDataVerification, plainOldSheets, newDataV, oldDataV);
  Object.keys(diffDataVerification.added).forEach((key) => {
    const item = diffDataVerification.added[key]
    changes.push({
      sheetId: currentSheetId, path: ['dataVerification'], value: item, key: key,
      type: 'update',
    })
  });

  Object.keys(diffDataVerification.removed).forEach((key) => {
    const item = diffDataVerification.removed[key];
    changes.push({
      sheetId: currentSheetId, path: ['dataVerification'], value: item, key: key,
      type: 'delete',
    })
  });
  if (changes.length > 0) {
    updateYdocSheetData(
      // @ts-ignore
      ydocRef.current,
      // @ts-ignore
      dsheetId,
      changes,
      // @ts-ignore
      handleContentPortal,
    );
  }


}