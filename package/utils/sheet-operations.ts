import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import {
  ySheetArrayToPlain,
} from './update-ydoc';
import { fromUint8Array } from 'js-base64';

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
  //return;
  console.log('dataBlockCalcFunction =====**', dsheetId, isReadOnly, data);
  // if (data?.length > 0) {
  //   return
  // }
  console.log('updateSheetData getting called');
  const currentSheetId: string = sheetEditor?.getWorkbookContext()
    ?.currentSheetId as string;

  let oldSheets = ydoc?.getArray(dsheetId);
  //@ts-ignore
  let plainOldSheets = ySheetArrayToPlain(oldSheets as Y.Array<Y.Map>)
  const currentSheet = sheetEditor?.getAllSheets()?.find(
    (sheet) => sheet.id === currentSheetId,
  )

  const currentYdocSheet = oldSheets?.toArray().find((s: any) => s.get('id') === currentSheetId) as any;


  const ydocOrder = currentYdocSheet?.get('order');
  const ydocName = currentYdocSheet?.get('name');
  const ydocConfig = currentYdocSheet?.get('config');

  console.log('currentYdocSheet', currentYdocSheet, ydocOrder, ydocName, ydocConfig, currentSheet);

  let changes = false;
  if (ydocOrder !== currentSheet?.order) {
    currentYdocSheet?.set('order', currentSheet?.order);
    changes = true;
    console.log('ydocOrder', ydocOrder);
  }
  if (ydocName !== currentSheet?.name) {
    currentYdocSheet?.set('name', currentSheet?.name);
    changes = true;
    console.log('ydocName', ydocName);
  }
  if (ydocConfig !== currentSheet?.config) {
    currentYdocSheet?.set('config', currentSheet?.config);
    changes = true;
    console.log('ydocConfig', ydocConfig);
  }

  if (changes) {
    const encodedUpdate = fromUint8Array(
      //@ts-ignore
      Y.encodeStateAsUpdate(ydoc),
    );
    handleContentPortal({ data: sheetEditor?.getAllSheets() }, encodedUpdate);
  }

  console.log('plainOldSheets', plainOldSheets, currentSheetId);

  if (!ydoc || !sheetEditor || !data.length || dataBlockCalcFunction || handleContentPortal) {
    return;
  }

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
