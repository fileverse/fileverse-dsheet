import * as Y from 'yjs';
import { Sheet } from '@sheet-engine/react';

export type SheetChangePath = {
  sheetId: string;
  path: string[]; // ['name'], ['config', 'merge'], ['celldata']
  key?: string; // 👈 only for celldata
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

const getSheetId = (sheet: Y.Map<any> | Record<string, any>) => {
  if (sheet instanceof Y.Map) return sheet.get('id');
  return (sheet as Record<string, any>)?.id;
};

const logYdocWarning = (context: string, details: Record<string, unknown>) => {
  console.warn(`[updateYdocSheetData] ${context}`, details);
};

export const updateYdocSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  changes: SheetChangePath[],
  handleContentPortal: any,
) => {
  if (!ydoc || !changes.length) return;

  const sheetArray = ydoc.getArray<any>(dsheetId);
  console.log('Applying sheet changes to Y.Doc:', changes, sheetArray.toJSON());

  ydoc.transact(() => {
    changes.forEach(({ sheetId, path, key, value, type }) => {
      const allSheets = sheetArray.toArray();
      const sheet = allSheets.find(
        (s: Y.Map<any> | Record<string, any>) => getSheetId(s) === sheetId,
      );

      if (!sheet) {
        logYdocWarning('sheet not found for change', {
          dsheetId,
          sheetId,
          path,
          key,
          type,
          value,
          allSheets,
        });
        return;
      }

      if (!(sheet instanceof Y.Map)) {
        logYdocWarning('matched sheet is not Y.Map, skipping change', {
          dsheetId,
          sheetId,
          path,
          key,
          type,
          value,
          sheet,
        });
        return;
      }

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

      // filter_select
      if (path.length === 1 && path[0] === 'filter_select' && key) {
        let cellMap = sheet.get('filter_select');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('filter_select', cellMap);
        }

        type === 'delete'
          ? cellMap.delete(key)
          : cellMap.set(key, toPlain(value));
        return;
      }

      // filter (object) - replace entire object payload
      if (path.length === 1 && path[0] === 'filter') {
        let filterMap = sheet.get('filter');
        if (!(filterMap instanceof Y.Map)) {
          filterMap = new Y.Map();
          sheet.set('filter', filterMap);
        }

        // clear existing keys
        (filterMap as Y.Map<any>).forEach((_v: any, k: string) => {
          filterMap.delete(k);
        });

        if (type === 'delete') return;

        const plainValue = toPlain(value) || {};
        if (
          plainValue &&
          typeof plainValue === 'object' &&
          !Array.isArray(plainValue)
        ) {
          Object.entries(plainValue).forEach(([k, v]) =>
            filterMap.set(k, toPlain(v)),
          );
        }
        return;
      }

      // luckysheet_conditionformat_save (array) - replace entire array payload
      if (path.length === 1 && path[0] === 'luckysheet_conditionformat_save') {
        let cellArray = sheet.get('luckysheet_conditionformat_save');
        if (!(cellArray instanceof Y.Array)) {
          cellArray = new Y.Array();
          sheet.set('luckysheet_conditionformat_save', cellArray);
        }

        cellArray.delete(0, cellArray.length);
        if (type === 'delete') return;

        const plainValue = toPlain(value);
        cellArray.insert(
          0,
          Array.isArray(plainValue) ? plainValue : [plainValue],
        );
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
    sheetArray.forEach((sheet: Y.Map<any> | Record<string, any>) => {
      if (sheet instanceof Y.Map) {
        sheet.set('status', sheet.get('order') === 0 ? 1 : 0);
        return;
      }

      logYdocWarning('status sync encountered non-Y.Map sheet', {
        dsheetId,
        sheet,
      });
    });
  });

  console.log(
    'Finished applying changes to Y.Doc. New state:',
    sheetArray.toJSON(),
  );

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

    // Handle legacy plain-object sheets (e.g. before migration) so we never call .forEach on a non-Map
    const iterate =
      sheetMap instanceof Y.Map
        ? (fn: (value: any, key: string) => void) => {
            sheetMap.forEach(fn);
          }
        : (fn: (value: any, key: string) => void) => {
            Object.entries(sheetMap as Record<string, any>).forEach(
              ([key, value]) => fn(value, key),
            );
          };

    iterate((value, key) => {
      // celldata: Y.Map → plain object for Fortune sheet format
      if (key === 'celldata' && value instanceof Y.Map) {
        obj.celldata = value.toJSON();
        return;
      }

      if (key === 'calcChain' && value instanceof Y.Map) {
        const calcChain = value.toJSON();
        if (Object.keys(calcChain).length === 0) return;
        obj.calcChain = calcChain;
        return;
      }

      if (
        key === 'luckysheet_conditionformat_save' &&
        value instanceof Y.Array
      ) {
        const conditionFormatRules = value.toJSON();
        if (conditionFormatRules.length === 0) return;
        obj.luckysheet_conditionformat_save = conditionFormatRules;
        return;
      }

      if (key === 'dataBlockCalcFunction' && value instanceof Y.Map) {
        const dataBlockCalcFunction = value.toJSON();
        if (Object.keys(dataBlockCalcFunction).length === 0) return;
        obj.dataBlockCalcFunction = dataBlockCalcFunction;
        return;
      }

      if (key === 'liveQueryList' && value instanceof Y.Map) {
        const liveQueryList = value.toJSON();
        if (Object.keys(liveQueryList).length === 0) return;
        obj.liveQueryList = liveQueryList;
        return;
      }

      if (key === 'dataVerification' && value instanceof Y.Map) {
        const dataVerification = value.toJSON();
        if (Object.keys(dataVerification).length === 0) return;
        obj.dataVerification = dataVerification;
        return;
      }

      if (key === 'hyperlink' && value instanceof Y.Map) {
        const hyperlink = value.toJSON();
        if (Object.keys(hyperlink).length === 0) return;
        obj.hyperlink = hyperlink;
        return;
      }

      if (key === 'conditionRules' && value instanceof Y.Map) {
        const conditionRules = value.toJSON();
        if (Object.keys(conditionRules).length === 0) return;
        obj.conditionRules = conditionRules;
        return;
      }

      if (key === 'filter_select' && value instanceof Y.Map) {
        const filterSelect = value.toJSON();
        if (Object.keys(filterSelect).length === 0) return;
        obj.filter_select = filterSelect;
        return;
      }

      if (key === 'filter' && value instanceof Y.Map) {
        const filter = value.toJSON();
        if (Object.keys(filter).length === 0) return;
        obj.filter = filter;
        return;
      }

      if (value instanceof Y.Map || value instanceof Y.Array) {
        obj[key] = value.toJSON();
      } else {
        obj[key] = value;
      }
    });

    // Ensure celldata/calcChain are arrays (legacy may have them as objects keyed by r_c)
    let cellDataArray;
    cellDataArray = obj.celldata ? Object.values(obj.celldata) : [];
    obj.celldata = cellDataArray;

    let calcChainArray;
    calcChainArray = obj.calcChain ? Object.values(obj.calcChain) : [];
    obj.calcChain = calcChainArray;
    return obj as Sheet;
  });
}
