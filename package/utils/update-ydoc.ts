import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';

export type SheetChangePath = {
  sheetId: string;
  path: string[];        // ['name'], ['config', 'merge'], ['celldata']
  key?: string;          // 👈 only for celldata
  value: any;
  type?: 'update' | 'delete';
};

/**
 * Deep-clone value so Yjs stores plain data (no proxies).
 */
function toPlain<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export const updateYdocSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  changes: SheetChangePath[],
  handleContentPortal: any,
) => {
  if (!ydoc || !changes.length) return;

  const sheetArray = ydoc.getArray<any>(dsheetId);

  ydoc.transact(() => {
    changes.forEach(({ sheetId, path, key, value, type }) => {
      const sheet = sheetArray
        .toArray()
        .find((s: Y.Map<any>) => s.get('id') === sheetId) as Y.Map<any> | undefined;

      if (!sheet) return;

      // Sheet fields stored as Y.Map use path + key for granular updates
      // celldata
      if (path.length === 1 && path[0] === 'celldata' && key) {
        let cellMap = sheet.get('celldata');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('celldata', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // calcChain
      if (path.length === 1 && path[0] === 'calcChain' && key) {
        let cellMap = sheet.get('calcChain');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('calcChain', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value?.v));
        return;
      }

      // dataBlockCalcFunction
      if (path.length === 1 && path[0] === 'dataBlockCalcFunction' && key) {
        let cellMap = sheet.get('dataBlockCalcFunction');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('dataBlockCalcFunction', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // liveQueryList
      if (path.length === 1 && path[0] === 'liveQueryList' && key) {
        let cellMap = sheet.get('liveQueryList');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('liveQueryList', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // dataVerification
      if (path.length === 1 && path[0] === 'dataVerification' && key) {
        let cellMap = sheet.get('dataVerification');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('dataVerification', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // hyperlink
      if (path.length === 1 && path[0] === 'hyperlink' && key) {
        let cellMap = sheet.get('hyperlink');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('hyperlink', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // conditionRules
      if (path.length === 1 && path[0] === 'conditionRules' && key) {
        let cellMap = sheet.get('conditionRules');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('conditionRules', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // luckysheet_conditionformat_save (array)
      if (path.length === 1 && path[0] === 'luckysheet_conditionformat_save' && key) {
        let cellArray = sheet.get('luckysheet_conditionformat_save');
        if (!(cellArray instanceof Y.Array)) {
          cellArray = new Y.Array();
          sheet.set('luckysheet_conditionformat_save', cellArray);
        }

        cellArray.delete(0, cellArray.length);
        cellArray.insert(0, [toPlain(value)]);
        return;
      }

      /**
       * ===== NORMAL PATH WALK =====
       */

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

      target.set(path[path.length - 1], toPlain(value));
    });

    // Keep a single active sheet by order after applying updates
    sheetArray.forEach((sheet: Y.Map<any>) => {
      sheet.set('status', sheet.get('order') === 0 ? 1 : 0);
    });
  });

  if (handleContentPortal) {
    handleContentPortal();
  }
};


export function ySheetArrayToPlain(
  // @ts-ignore
  sheetArray: Y.Array<Y.Map>,
): Sheet[] {
  return sheetArray.toArray().map((sheetMap) => {
    const obj: any = {};

    // @ts-ignore
    sheetMap.forEach((value, key) => {
      // celldata: Y.Map → plain object for Fortune sheet format
      if (key === 'celldata' && value instanceof Y.Map) {
        obj.celldata = value.toJSON();
        return;
      }

      if (key === 'calcChain' && value instanceof Y.Map) {
        let calcChain = value.toJSON();
        if (Object.keys(calcChain).length === 0) return
        obj.calcChain = calcChain;
        return;
      }

      if (key === 'luckysheet_conditionformat_save' && value instanceof Y.Map) {
        let conditionRules = value.toJSON();
        if (conditionRules.length === 0) return
        obj.conditionRules = conditionRules;
        return;
      }

      if (key === 'dataBlockCalcFunction' && value instanceof Y.Map) {
        let dataBlockCalcFunction = value.toJSON();
        if (Object.keys(dataBlockCalcFunction).length === 0) return
        obj.dataBlockCalcFunction = dataBlockCalcFunction;
        return;
      }

      if (key === 'liveQueryList' && value instanceof Y.Map) {
        let liveQueryList = value.toJSON();
        if (Object.keys(liveQueryList).length === 0) return
        obj.liveQueryList = liveQueryList;
        return;
      }

      if (key === 'dataVerification' && value instanceof Y.Map) {
        let dataVerification = value.toJSON();
        if (Object.keys(dataVerification).length === 0) return
        obj.dataVerification = dataVerification;
        return;
      }

      if (key === 'hyperlink' && value instanceof Y.Map) {
        let hyperlink = value.toJSON();
        if (Object.keys(hyperlink).length === 0) return
        obj.hyperlink = hyperlink;
        return;
      }

      if (key === 'conditionRules' && value instanceof Y.Map) {
        let conditionRules = value.toJSON();
        if (Object.keys(conditionRules).length === 0) return
        obj.conditionRules = conditionRules;
        return;
      }

      if (value instanceof Y.Map || value instanceof Y.Array) {
        obj[key] = value.toJSON();
      } else {
        obj[key] = value;
      }
    });

    let cellDataArray;
    cellDataArray = obj.celldata ? Object.values(obj.celldata) : [];
    obj.celldata = cellDataArray;

    let calcChainArray;
    calcChainArray = obj.calcChain ? Object.values(obj.calcChain) : [];
    obj.calcChain = calcChainArray;
    return obj as Sheet;
  });
}