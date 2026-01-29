import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { updateYdocSheetData, ySheetArrayToPlain } from './update-ydoc';
import * as Y from 'yjs';
import { diffObjectArrays } from './diff-sheet';
// import { fromUint8Array } from 'js-base64';

// type SheetChangePath = {
//   sheetId: string;
//   path: string[];        // ['name'], ['config', 'merge'], ['celldata']
//   key?: string;          // 👈 only for celldata
//   value: any;
//   type?: 'update' | 'delete';
// };


/**
 * Verifies the integrity of sheet data in a YDoc against a given sheet editor instance.
 * This function is used to verify that the sheet data in a YDoc matches the data in a sheet editor instance.
 * @param {Object} options
 * @param {React.RefObject<WorkbookInstance | null>} options.sheetEditorRef - Reference to the sheet editor instance
 * @param {React.RefObject<Y.Doc | null>} options.ydocRef - Reference to the YDoc instance
 * @returns {void}
 */
export const conditionFormatYdocUpdate = ({
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
  console.log('conditionFormatYdocUpdate', sheetEditorRef, ydocRef, handleContentPortal, updateYdocSheetData);
  if (!sheetEditorRef.current || !ydocRef.current) return;
  const currentSheetId: string = sheetEditorRef.current?.getWorkbookContext()
    ?.currentSheetId as string;
  let newDataV = sheetEditorRef.current?.getSheet()?.luckysheet_conditionformat_save || [];
  let oldSheets = ydocRef.current?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)
  let oldDataV = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.luckysheet_conditionformat_save || [];

  //@ts-ignore
  const diffConditionFormat = diffObjectArrays(oldDataV, newDataV);
  // const changes: SheetChangePath[] = []
  console.log('diffDataVerification', diffConditionFormat, plainOldSheets, newDataV, oldDataV);

  if (diffConditionFormat.added.length > 0 || diffConditionFormat.removed.length > 0 || diffConditionFormat.updated.length > 0) {
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditorRef.current,
      [{
        sheetId: currentSheetId, path: ['luckysheet_conditionformat_save'], value: newDataV, key: 'luckysheet_conditionformat_save',
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    )

  }

}