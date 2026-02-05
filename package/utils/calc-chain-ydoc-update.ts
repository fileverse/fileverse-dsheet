import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { updateYdocSheetData, ySheetArrayToPlain } from './update-ydoc';
import * as Y from 'yjs';
import { diffObjectArrays } from './diff-sheet';
// import { fromUint8Array } from 'js-base64';

type SheetChangePath = {
  sheetId: string;
  path: string[];        // ['name'], ['config', 'merge'], ['celldata']
  key?: string;          // 👈 only for celldata
  value: any;
  type?: 'update' | 'delete';
};

const getCalcChainKey = (item: any) =>
  `${item.r}_${item.c}`;


/**
 * Verifies the integrity of sheet data in a YDoc against a given sheet editor instance.
 * This function is used to verify that the sheet data in a YDoc matches the data in a sheet editor instance.
 * @param {Object} options
 * @param {React.RefObject<WorkbookInstance | null>} options.sheetEditorRef - Reference to the sheet editor instance
 * @param {React.RefObject<Y.Doc | null>} options.ydocRef - Reference to the YDoc instance
 * @returns {void}
 */
export const calcChainYdocUpdate = ({
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
  console.log('calcChainYdocUpdate', sheetEditorRef, ydocRef, handleContentPortal, updateYdocSheetData);
  if (!sheetEditorRef.current || !ydocRef.current) return;
  const currentSheetId: string = sheetEditorRef.current?.getWorkbookContext()
    ?.currentSheetId as string;
  let newDataC = sheetEditorRef.current?.getSheet()?.calcChain || [];
  let oldSheets = ydocRef.current?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)
  let oldDataC = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.calcChain || [];

  //@ts-ignore
  const calcChainDiff = diffObjectArrays(oldDataC, newDataC, getCalcChainKey)
  const changes: SheetChangePath[] = []
  console.log('diffCalcChain', calcChainDiff, plainOldSheets, newDataC, oldDataC);
  if (calcChainDiff?.added?.length) {
    calcChainDiff.added.forEach((item) => {
      changes.push({
        sheetId: currentSheetId, path: ['calcChain'], value: {
          r: item.r,
          c: item.c,
          v: item,
        }, key: item.r + '_' + item.c,
        type: 'update',
      })
    });
  }

  calcChainDiff?.removed?.forEach((item) => {
    changes.push({
      sheetId: currentSheetId, path: ['calcChain'], value: {
        r: item.r,
        c: item.c,
        v: item,
      }, key: item.r + '_' + item.c,
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