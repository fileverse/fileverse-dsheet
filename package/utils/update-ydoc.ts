import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
import { fromUint8Array } from 'js-base64';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';

type SheetChangePath = {
  sheetId: string;
  path: string[];        // ['name'], ['config', 'merge'], ['celldata']
  key?: string;          // 👈 only for celldata
  value: any;
  type?: 'update' | 'delete';
};

export const updateYdocSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  sheetEditor: WorkbookInstance | null,
  changes: SheetChangePath[],
  handleContentPortal: any,
  // isReadOnly?: boolean,
) => {
  if (!ydoc || !sheetEditor || !changes.length) {
    return;
  }

  const sheetArray = ydoc.getArray<any>(dsheetId);
  console.log('sheetArray', sheetArray.toArray());

  ydoc.transact(() => {
    /**
     * STEP 1: MIGRATION (plain object → Y.Map)
     */


    /**
     * STEP 2: APPLY CHANGES
     */
    changes.forEach(({ sheetId, path, key, value, type }) => {
      //@ts-ignore
      const sheet = sheetArray.toArray().find((s: Y.Map) => s.get('id') === sheetId) as Y.Map | undefined;

      if (!sheet) return;

      // SPECIAL CASE: celldata merge
      if (path.length === 1 && path[0] === 'celldata' && key) {
        let cellMap = sheet.get('celldata');

        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('celldata', cellMap);
        }

        if (type === 'delete') {
          cellMap.delete(key);
        } else {
          cellMap.set(key, value);
        }
        return;
      }

      // SPECIAL CASE: celldata merge
      if (path.length === 1 && path[0] === 'calcChain' && key) {
        let cellMap = sheet.get('calcChain');

        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('calcChain', cellMap);
        }

        if (type === 'delete') {
          cellMap.delete(key);
        } else {
          cellMap.set(key, value.v);
        }
        return;
      }

      // SPECIAL CASE: celldata merge
      if (path.length === 1 && path[0] === 'dataBlockCalcFunction' && key) {
        let cellMap = sheet.get('dataBlockCalcFunction');

        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('dataBlockCalcFunction', cellMap);
        }

        if (type === 'delete') {
          cellMap.delete(key);
        } else {
          console.log('valuewww', value);
          cellMap.set(key, value);
        }
        return;
      }

      // NORMAL PATH WALK (config, name, order, etc.)
      let target: any = sheet;

      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i];
        let next = target.get(p);

        if (!(next instanceof Y.Map)) {
          next = new Y.Map();
          target.set(p, next);
        }

        target = next;
      }

      target.set(path[path.length - 1], value);
    });

    /**
     * STEP 3: status update
     */
    //@ts-ignore
    sheetArray.forEach((sheet: Y.Map) => {
      sheet.set(
        'status',
        sheet.get('order') === 0 ? 1 : 0,
      );
    });
  });
  const encodedUpdate = fromUint8Array(
    Y.encodeStateAsUpdate(ydoc),
  );
  handleContentPortal({ data: sheetArray.toArray() }, encodedUpdate);
};

export function ySheetArrayToPlain(
  // @ts-ignore
  sheetArray: Y.Array<Y.Map>,
): Sheet[] {
  return sheetArray.toArray().map((sheetMap) => {
    const obj: any = {};

    // @ts-ignore
    sheetMap.forEach((value, key) => {
      console.log('key', key, 'value', value);
      // ✅ celldata: Y.Map → plain object
      if (key === 'celldata' && value instanceof Y.Map) {
        obj.celldata = value.toJSON();
        return;
      }

      if (key === 'calcChain' && value instanceof Y.Map) {
        let calcChain = value.toJSON();
        console.log('calcChain in converter function', calcChain);
        calcChain = Object.keys(calcChain).length === 0 ? [] : calcChain;
        obj.calcChain = calcChain;
        return;
      }

      if (key === 'dataBlockCalcFunction' && value instanceof Y.Map) {
        let dataBlockCalcFunction = value.toJSON();
        console.log('dataBlockCalcFunction in converter function', dataBlockCalcFunction);
        dataBlockCalcFunction = Object.keys(dataBlockCalcFunction).length === 0 ? {} : dataBlockCalcFunction;
        obj.dataBlockCalcFunction = dataBlockCalcFunction;
        return;
      }

      if (value instanceof Y.Map || value instanceof Y.Array) {
        obj[key] = value.toJSON();
      } else {
        obj[key] = value;
      }
    });

    let cellDataArray;
    cellDataArray = Object.values(obj.celldata);
    obj.celldata = cellDataArray;

    let calcChainArray;
    calcChainArray = Object.values(obj.calcChain);
    obj.calcChain = calcChainArray;

    return obj as Sheet;
  });
}