import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import {
  ySheetArrayToPlain,
  updateYdocSheetData
} from './update-ydoc';
import { diffObjectArrays, diffObjectMap } from './diff-sheet';

//@ts-ignore
const getCalcChainKey = (item: CalcChainItem) =>
  `${item.r}_${item.c}`;

export const updateSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  data: Sheet[],
  sheetEditor: WorkbookInstance | null,
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } },
  isReadOnly?: boolean,
  handleContentPortal?: any
) => {
  console.log('dataBlockCalcFunction =====**', dsheetId, isReadOnly, data);
  if (data?.length > 0) {
    return
  }
  const currentSheetId: string = sheetEditor?.getWorkbookContext()
    ?.currentSheetId as string;
  // if (dataBlockCalcFunction?.[currentSheetId as string]) {
  //   data = (data as Sheet[]).map((sheet) => {
  //     return {
  //       ...sheet,
  //       dataBlockCalcFunction: dataBlockCalcFunction[sheet.id as string],
  //     };
  //   });
  // }

  let oldSheets = ydoc?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)

  const newC = sheetEditor?.getSheet()?.calcChain;

  const oldCalc = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.calcChain;


  //@ts-ignore
  const d = diffObjectArrays(oldCalc, newC, getCalcChainKey)


  // console.log('data rrr', data, "tooo", oldCalc, newC, d, plainOldSheets, currentSheetId, oldSheets);
  if (d?.added?.length) {
    d.added.forEach((item) => {
      updateYdocSheetData(
        // @ts-ignore
        ydoc,
        // @ts-ignore
        dsheetId,
        sheetEditor,
        [{
          sheetId: currentSheetId, path: ['calcChain'], value: {
            r: item.r,
            c: item.c,
            v: item,
          }, key: item.r + '_' + item.c,
          type: 'update',
        }],
        // @ts-ignore
        handleContentPortal,
      );
    });
  }
  d?.removed?.forEach((item) => {
    updateYdocSheetData(
      ydoc,
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['calcChain'], value: {
          r: item.r,
          c: item.c,
          v: item,
        }, key: item.r + '_' + item.c,
        type: 'delete',
      }],
      // @ts-ignore
      handleContentPortal,
    )
  });

  // dataBlockCalcFunction =============

  let newDataB = dataBlockCalcFunction?.[currentSheetId as string]
  let oldDataB = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.dataBlockCalcFunction;

  oldDataB = oldDataB ? oldDataB : {}

  newDataB = newDataB ? newDataB : {}

  const dataBlockDiff = diffObjectMap(oldDataB, newDataB)

  Object.keys(dataBlockDiff.added).forEach((key) => {
    const item = dataBlockDiff.added[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['dataBlockCalcFunction'], value: item, key: key,
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });

  Object.keys(dataBlockDiff.removed).forEach((key) => {
    const item = dataBlockDiff.removed[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['dataBlockCalcFunction'], value: item, key: key,
        type: 'delete',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });

  // live query ================

  console.log('plainOldSheets', plainOldSheets, currentSheetId);

  const oldLiveQuery = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.liveQueryList || {};

  const newLiveQuery = sheetEditor?.getSheet()?.liveQueryList || {};
  console.log('oldLiveQuery', oldLiveQuery, newLiveQuery);

  const liveQueryDiff = diffObjectMap(oldLiveQuery, newLiveQuery);

  console.log('liveQueryDiff', liveQueryDiff, plainOldSheets, sheetEditor?.getSheet());

  Object.keys(liveQueryDiff.added).forEach((key) => {
    const item = liveQueryDiff.added[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['liveQueryList'], value: item, key: key,
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });

  Object.keys(liveQueryDiff.removed).forEach((key) => {
    const item = liveQueryDiff.removed[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['liveQueryList'], value: item, key: key,
        type: 'delete',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });


  // dataVerification =============

  let newDataV = sheetEditor?.getSheet()?.dataVerification || {};
  let oldDataV = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.dataVerification || {};

  const diffDataVerification = diffObjectMap(oldDataV, newDataV);

  // console.log('diffDataVerification', diffDataVerification, plainOldSheets, sheetEditor?.getSheet(), oldDataV, newDataV);

  Object.keys(diffDataVerification.added).forEach((key) => {
    const item = diffDataVerification.added[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['dataVerification'], value: item, key: key,
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });

  Object.keys(diffDataVerification.removed).forEach((key) => {
    const item = diffDataVerification.removed[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['dataVerification'], value: item, key: key,
        type: 'delete',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });


  // conditionRules =============

  let newConditionRules = sheetEditor?.getSheet()?.conditionRules || {};
  let oldConditionRules = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.conditionRules || {};

  const diffConditionRules = diffObjectMap(oldConditionRules, newConditionRules);

  console.log('diffConditionRules', diffConditionRules, plainOldSheets, sheetEditor?.getSheet(), oldConditionRules, newConditionRules);

  Object.keys(diffConditionRules.added).forEach((key) => {
    const item = diffConditionRules.added[key]
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['conditionRules'], value: item, key: key,
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    );
  });

  // Object.keys(diffConditionRules.removed).forEach((key) => {
  //   const item = diffConditionRules.removed[key]
  //   updateYdocSheetData(
  //     // @ts-ignore
  //     ydoc,
  //     // @ts-ignore
  //     dsheetId,
  //     sheetEditor,
  //     [{
  //       sheetId: currentSheetId, path: ['conditionRules'], value: item, key: key,
  //       type: 'delete',
  //     }],
  //     // @ts-ignore
  //     handleContentPortal,
  //   );
  // });


  // luckysheet_conditionformat_save ============

  let newLuckysheet_conditionformat_save = sheetEditor?.getSheet()?.luckysheet_conditionformat_save || [];
  let oldLuckysheet_conditionformat_save = plainOldSheets?.find(
    (sheet) => sheet.id === currentSheetId,
  )?.luckysheet_conditionformat_save || [];

  const diffLuckysheet_conditionformat_save = diffObjectArrays(oldLuckysheet_conditionformat_save, newLuckysheet_conditionformat_save);
  console.log('diffLuckysheet_conditionformat_save', diffLuckysheet_conditionformat_save, plainOldSheets, sheetEditor?.getSheet(), oldLuckysheet_conditionformat_save, newLuckysheet_conditionformat_save);

  if (diffLuckysheet_conditionformat_save.added.length > 0 || diffLuckysheet_conditionformat_save.removed.length > 0 || diffLuckysheet_conditionformat_save.updated.length > 0) {
    updateYdocSheetData(
      // @ts-ignore
      ydoc,
      // @ts-ignore
      dsheetId,
      sheetEditor,
      [{
        sheetId: currentSheetId, path: ['luckysheet_conditionformat_save'], value: newLuckysheet_conditionformat_save, key: 'luckysheet_conditionformat_save',
        type: 'update',
      }],
      // @ts-ignore
      handleContentPortal,
    )

  }





  if (!ydoc || !sheetEditor || !data.length || dataBlockCalcFunction || handleContentPortal) {
    return;
  }

  // const sheetArray = ydoc.getArray(dsheetId);
  // const preSheetArray = Array.from(sheetArray) as Sheet[];

  // const formattedData = formatSheetData(data, preSheetArray, sheetEditor);
  // const statusUpdatedFormattedData = formattedData.map((sheet: Sheet) => {
  //   const sheetData = { ...sheet };
  //   sheetData.status = sheetData.order === 0 ? 1 : 0;
  //   return sheetData;
  // });
  // Only update YJS if there's an actual change
  // if (
  //   isSpreadsheetChanged(Array.from(sheetArray) as Sheet[], statusUpdatedFormattedData) &&
  //   !isReadOnly
  // ) {
  //   console.log('preSheetArray', preSheetArray);
  //   console.log('statusUpdatedFormattedData', statusUpdatedFormattedData);
  //   // Perform the update in a transaction
  //   // ydoc.transact(() => {
  //   //   sheetArray.delete(0, preSheetArray.length);
  //   //   sheetArray.insert(0, statusUpdatedFormattedData);
  //   // });
  // }
};

export const formatSheetData = (
  data: Sheet[],
  preSheetArray: Sheet[],
  sheetEditor: WorkbookInstance,
): Sheet[] => {
  return data.map((sheet: Sheet, index) => {
    const sheetCellData = sheet['data'];
    if (!sheetCellData) return sheet;

    const transformedData = sheetEditor.dataToCelldata(sheetCellData);
    const newSheet = {
      ...sheet,
      celldata: transformedData,
      row: preSheetArray[index]?.row || sheet.row,
      column: preSheetArray[index]?.column || sheet.column,
      status: preSheetArray[index]?.status || sheet.status,
      order: sheet.order,
      config: sheet.config,
      dataVerification:
        sheet.dataVerification || preSheetArray[index]?.dataVerification,
      conditionRules:
        // @ts-ignore
        sheet.conditionRules || preSheetArray[index]?.conditionRules,
    };
    delete newSheet.data;
    return newSheet;
  });
};
