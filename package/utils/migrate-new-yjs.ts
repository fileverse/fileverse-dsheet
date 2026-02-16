import * as Y from 'yjs';
import { Sheet } from '@fileverse-dev/fortune-react';
// import { ySheetArrayToPlain } from "./update-ydoc";

function normalizeCelldataArray(
  celldata: any[],
): Record<string, any> {
  const result: Record<string, any> = {};

  celldata.forEach((cell) => {
    if (
      typeof cell?.r === 'number' &&
      typeof cell?.c === 'number'
    ) {
      const key = `${cell.r}_${cell.c}`;
      result[key] = cell;
    }
  });

  return result;
}
export function migrateSheetArrayIfNeeded(
  ydoc: Y.Doc,
  sheetArray: Y.Array<any>,
) {
  let needsMigration = false;

  sheetArray.forEach((item) => {
    if (!(item instanceof Y.Map)) {
      needsMigration = true;
    }
  });

  if (!needsMigration) return;

  ydoc.transact(() => {
    sheetArray.forEach((item, index) => {
      if (item instanceof Y.Map) return;

      const sheetMap = new Y.Map();

      Object.entries(item).forEach(([key, value]) => {
        // celldata array → Y.Map keyed by r_c for efficient Yjs updates
        if (key === 'celldata' && Array.isArray(value)) {
          const cellMap = new Y.Map();
          const normalized = normalizeCelldataArray(value);

          Object.entries(normalized).forEach(
            ([cellKey, cellValue]) => {
              cellMap.set(cellKey, cellValue);
            },
          );

          sheetMap.set('celldata', cellMap);
          return;
        }
        if (key === 'calcChain' && Array.isArray(value)) {
          const calcChainMap = new Y.Map();
          const normalized = normalizeCelldataArray(value);

          Object.entries(normalized).forEach(
            ([cellKey, cellValue]) => {
              calcChainMap.set(cellKey, cellValue);
            },
          );

          sheetMap.set('calcChain', calcChainMap);
          return;
        }

        if (key === 'luckysheet_conditionformat_save' && Array.isArray(value)) {
          const luckysheet_conditionformat_save = new Y.Array();
          value.forEach((item) => {
            luckysheet_conditionformat_save.push([item]); // 👈 wrap in array
          });

          sheetMap.set(
            'luckysheet_conditionformat_save',
            luckysheet_conditionformat_save
          );
          return;
        }

        if (key === 'dataBlockCalcFunction') {
          const dataBlockCalcFunction = new Y.Map();
          Object.entries(value as object).forEach(([k, v]) =>
            dataBlockCalcFunction.set(k, v),
          );
          sheetMap.set('dataBlockCalcFunction', dataBlockCalcFunction);
          return;
        }

        if (key === 'dataVerification') {
          const dataVerification = new Y.Map();
          const dV = value ? value : {};
          Object.entries(dV as object).forEach(([k, v]) =>
            dataVerification.set(k, v),
          );
          sheetMap.set('dataVerification', dataVerification);
          return;
        }

        if (key === 'hyperlink') {
          const hyperlink = new Y.Map();
          const hL = value ? value : {};
          Object.entries(hL as object).forEach(([k, v]) =>
            hyperlink.set(k, v),
          );
          sheetMap.set('hyperlink', hyperlink);
          return;
        }

        if (key === 'conditionRules') {
          const conditionRules = new Y.Map();
          const cR = value ? value : {};
          Object.entries(cR as object).forEach(([k, v]) =>
            conditionRules.set(k, v),
          );
          sheetMap.set('conditionRules', conditionRules);
          return;
        }

        if (key === 'config') {
          // const config = new Y.Map();
          // const cR = value ? value : {};
          // Object.entries(cR as object).forEach(([k, v]) =>
          //   config.set(k, v),
          // );
          sheetMap.set('config', value);
          return
        }

        // nested object → Y.Map
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          const yMap = new Y.Map();
          Object.entries(value).forEach(([k, v]) =>
            yMap.set(k, v),
          );
          sheetMap.set(key, yMap);
          return;
        }

        // primitives
        sheetMap.set(key, value);
      });

      if (sheetArray?.delete) {
        sheetArray.delete(index, 1);
        sheetArray.insert(index, [sheetMap]);
      }
    });
  });
}

type SheetFactory = () => Y.Map<any>;

export function migrateSheetFactoryForImport(
  sheet: Sheet | Y.Map<any>
): SheetFactory {
  // already Yjs → reuse directly
  if (sheet instanceof Y.Map) {
    return () => sheet;
  }

  return () => {
    const sheetMap = new Y.Map();

    Object.entries(sheet).forEach(([key, value]) => {
      if (key === 'celldata' && Array.isArray(value)) {
        const cellMap = new Y.Map();
        const normalized = normalizeCelldataArray(value);

        Object.entries(normalized).forEach(([k, v]) => {
          cellMap.set(k, v);
        });

        sheetMap.set('celldata', cellMap);
        return;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const yMap = new Y.Map();
        Object.entries(value).forEach(([k, v]) => yMap.set(k, v));
        sheetMap.set(key, yMap);
        return;
      }

      sheetMap.set(key, value);
    });

    return sheetMap;
  };
}


