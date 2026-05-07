import * as Y from 'yjs';
import { Sheet } from '@sheet-engine/react';
import { current, isDraft } from 'immer';

export type SheetChangePath = {
  sheetId: string;
  path: string[]; // ['name'], ['config', 'merge'], ['celldata']
  key?: string; // 👈 only for celldata
  value: any;
  type?: 'update' | 'delete';
};

function cloneForYjs<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return deepCloneSafe(value);
  }
}

function safeIsArray(value: unknown): boolean {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function deepCloneSafe<T>(value: T): T {
  const seen = new WeakMap<object, any>();

  const walk = (input: any): any => {
    if (input === null || typeof input !== 'object') return input;

    if (seen.has(input)) return seen.get(input);

    if (safeIsArray(input)) {
      const arr: any[] = [];
      seen.set(input, arr);
      let len = 0;
      try {
        len = Number((input as any).length) || 0;
      } catch {
        return arr;
      }
      for (let i = 0; i < len; i += 1) {
        try {
          arr.push(walk((input as any)[i]));
        } catch {
          arr.push(null);
        }
      }
      return arr;
    }

    const out: Record<string, any> = {};
    seen.set(input, out);
    let keys: (string | symbol)[] = [];
    try {
      keys = Reflect.ownKeys(input);
    } catch {
      return out;
    }
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (typeof k !== 'string') continue;
      try {
        out[k] = walk((input as any)[k]);
      } catch {
        out[k] = null;
      }
    }
    return out;
  };

  return walk(value) as T;
}

/**
 * Convert draft/proxy-ish values to plain data for Yjs.
 * Fast path: primitives and non-draft objects are returned as-is.
 */
function toPlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  try {
    if (isDraft(value)) {
      return current(value) as T;
    }
  } catch {
    // Proxy/revoked proxy can throw during draft detection; force deep-plain fallback.
    return cloneForYjs(value);
  }
  // Keep low-memory fast path for plain non-draft objects.
  // But revoked proxies can still throw when Yjs introspects them (e.g. GetPrototypeOf / isArray).
  try {
    Object.getPrototypeOf(value);
    return value;
  } catch {
    return cloneForYjs(value);
  }
}

function normalizeForYjs<T>(value: T): T {
  const plainValue = toPlain(value);
  if (plainValue === null || typeof plainValue !== 'object') {
    return plainValue;
  }
  return cloneForYjs(plainValue);
}

function setMapValueSafe(target: Y.Map<any>, key: string, value: any) {
  const normalizedValue = normalizeForYjs(value);
  try {
    target.set(key, normalizedValue);
  } catch {
    target.set(key, cloneForYjs(normalizedValue));
  }
}

const getSheetId = (sheet: Y.Map<any> | Record<string, any>) => {
  if (sheet instanceof Y.Map) return sheet.get('id');
  return (sheet as Record<string, any>)?.id;
};

export const updateYdocSheetData = (
  ydoc: Y.Doc | null,
  dsheetId: string,
  changes: SheetChangePath[],
  handleContentPortal: any,
) => {
  if (!ydoc || !changes.length) return;

  const sheetArray = ydoc.getArray<any>(dsheetId);

  ydoc.transact(() => {
    const allSheets = sheetArray.toArray();
    const sheetById = new Map<string, Y.Map<any>>();
    for (let i = 0; i < allSheets.length; i += 1) {
      const s = allSheets[i];
      if (!(s instanceof Y.Map)) continue;
      const id = s.get('id');
      if (typeof id === 'string' && !sheetById.has(id)) {
        sheetById.set(id, s);
      }
    }

    changes.forEach(({ sheetId, path, key, value, type }) => {
      const sheet = sheetById.get(sheetId);
      if (!sheet) return;

      // Sheet fields stored as Y.Map use path + key for granular updates
      // celldata
      if (path.length === 1 && path[0] === 'celldata' && key) {
        let cellMap = sheet.get('celldata');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('celldata', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
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
          : setMapValueSafe(cellMap, key, value?.v);
        return;
      }

      // dataBlockCalcFunction
      if (path.length === 1 && path[0] === 'dataBlockCalcFunction' && key) {
        let cellMap = sheet.get('dataBlockCalcFunction');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('dataBlockCalcFunction', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
        return;
      }

      // liveQueryList
      if (path.length === 1 && path[0] === 'liveQueryList' && key) {
        let cellMap = sheet.get('liveQueryList');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('liveQueryList', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
        return;
      }

      // dataVerification
      if (path.length === 1 && path[0] === 'dataVerification' && key) {
        let cellMap = sheet.get('dataVerification');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('dataVerification', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
        return;
      }

      // hyperlink
      if (path.length === 1 && path[0] === 'hyperlink' && key) {
        let cellMap = sheet.get('hyperlink');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('hyperlink', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
        return;
      }

      // conditionRules
      if (path.length === 1 && path[0] === 'conditionRules' && key) {
        let cellMap = sheet.get('conditionRules');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('conditionRules', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
        return;
      }

      // filter_select
      if (path.length === 1 && path[0] === 'filter_select' && key) {
        let cellMap = sheet.get('filter_select');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('filter_select', cellMap);
        }

        type === 'delete' ? cellMap.delete(key) : setMapValueSafe(cellMap, key, value);
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
          !safeIsArray(plainValue)
        ) {
          Object.entries(plainValue).forEach(([k, v]) => {
            setMapValueSafe(filterMap as Y.Map<any>, k, v);
          });
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

        const plainValue = normalizeForYjs(value);
        const payload = safeIsArray(plainValue) ? plainValue : [plainValue];
        try {
          cellArray.insert(0, payload);
        } catch {
          cellArray.insert(0, cloneForYjs(payload));
        }
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

      setMapValueSafe(target, path[path.length - 1], value);
    });

    // Keep a single active sheet by order after applying updates
    for (let i = 0; i < allSheets.length; i += 1) {
      const sheet = allSheets[i];
      if (!(sheet instanceof Y.Map)) continue;
      sheet.set('status', sheet.get('order') === 0 ? 1 : 0);
    }
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
