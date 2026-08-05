import * as Y from 'yjs';
import type { CellMatrix, CellWithRowAndCol, Sheet } from '../../sheet-engine/core/types';
import { compactBorderInfo } from '../../sheet-engine/core/paste/paste-border-utils';
import { shouldPersistCelldataCell } from '../../sheet-engine/core/utils/cell-persist-utils';
import type { SheetChangePath } from './update-ydoc';

/** Celldata + borderInfo compaction; bump when rules change. */
export const SHEET_COMPACTION_REV = 2;
export const SHEET_COMPACTION_CONFIG_KEY = 'sheetCompactionRev';

export type SheetCompactionResult = {
  removedFromYdoc: number;
  clearedInMemory: number;
  changes: SheetChangePath[];
};

function readConfigValue(config: unknown, key: string): unknown {
  if (config instanceof Y.Map) return config.get(key);
  if (config && typeof config === 'object') {
    return (config as Record<string, unknown>)[key];
  }
  return undefined;
}

function readConfigBorderInfo(config: unknown): any[] | null {
  const value = readConfigValue(config, 'borderInfo');
  return Array.isArray(value) ? value : null;
}

export function readSheetCompactionRev(config: unknown): number {
  const value = readConfigValue(config, SHEET_COMPACTION_CONFIG_KEY);
  return typeof value === 'number' ? value : 0;
}

export function getAnchorSheet(sheets: Sheet[] | null | undefined): Sheet | null {
  if (!sheets?.length) return null;
  let anchor = sheets[0];
  for (let i = 1; i < sheets.length; i += 1) {
    const sheet = sheets[i];
    if ((sheet.order ?? 0) < (anchor.order ?? 0)) anchor = sheet;
  }
  return anchor;
}

function getAnchorSheetEntry(
  sheetArray: Y.Array<unknown>,
): { sheetId: string; entry: Y.Map<unknown> } | null {
  let best: { sheetId: string; entry: Y.Map<unknown>; order: number } | null =
    null;

  for (let i = 0; i < sheetArray.length; i += 1) {
    const sheetEntry = sheetArray.get(i);
    if (!(sheetEntry instanceof Y.Map)) continue;
    const sheetId = sheetEntry.get('id');
    if (typeof sheetId !== 'string') continue;
    const order = sheetEntry.get('order');
    const orderNum = typeof order === 'number' ? order : 0;
    if (!best || orderNum < best.order) {
      best = { sheetId, entry: sheetEntry, order: orderNum };
    }
  }

  if (!best) return null;
  return { sheetId: best.sheetId, entry: best.entry };
}

export function hasSheetCompactionCompleted(
  ydoc: Y.Doc,
  dsheetId: string,
): boolean {
  const anchor = getAnchorSheetEntry(ydoc.getArray(dsheetId));
  if (!anchor) return true;
  return (
    readSheetCompactionRev(anchor.entry.get('config')) >= SHEET_COMPACTION_REV
  );
}

export function buildCompactionRevChange(
  ydoc: Y.Doc,
  dsheetId: string,
): SheetChangePath | null {
  const anchor = getAnchorSheetEntry(ydoc.getArray(dsheetId));
  if (!anchor) return null;
  if (
    readSheetCompactionRev(anchor.entry.get('config')) >= SHEET_COMPACTION_REV
  ) {
    return null;
  }
  return {
    sheetId: anchor.sheetId,
    path: ['config', SHEET_COMPACTION_CONFIG_KEY],
    value: SHEET_COMPACTION_REV,
    type: 'update',
  };
}

export function markCompactionRevInMemory(
  sheets: Sheet[] | null | undefined,
): void {
  const anchor = getAnchorSheet(sheets);
  if (!anchor) return;
  anchor.config = {
    ...(anchor.config ?? {}),
    [SHEET_COMPACTION_CONFIG_KEY]: SHEET_COMPACTION_REV,
  };
}

function cellFromCelldataEntry(entry: unknown): unknown {
  if (entry == null || typeof entry !== 'object') return entry;
  if ('v' in (entry as Record<string, unknown>)) {
    return (entry as { v?: unknown }).v;
  }
  return entry;
}

/** Collect Yjs celldata keys that should not be persisted (format-only / empty ghosts). */
export function collectStaleCelldataKeys(
  celldataMap: Y.Map<unknown> | Record<string, unknown> | null | undefined,
): string[] {
  const stale: string[] = [];
  if (!celldataMap) return stale;

  if (celldataMap instanceof Y.Map) {
    celldataMap.forEach((entry, key) => {
      const cell = cellFromCelldataEntry(entry);
      if (!shouldPersistCelldataCell(cell as any)) {
        stale.push(String(key));
      }
    });
    return stale;
  }

  Object.entries(celldataMap).forEach(([key, entry]) => {
    const cell = cellFromCelldataEntry(entry);
    if (!shouldPersistCelldataCell(cell as any)) {
      stale.push(key);
    }
  });
  return stale;
}

export function buildCelldataDeleteChanges(
  sheetId: string,
  keys: string[],
): SheetChangePath[] {
  return keys.map((key) => ({
    sheetId,
    path: ['celldata'],
    key,
    value: null,
    type: 'delete' as const,
    skipIfPersistable: true,
  }));
}

/** Null out dense-grid cells that should not be persisted. */
export function compactSheetDataMatrix(
  data: CellMatrix | null | undefined,
): number {
  if (!data?.length) return 0;
  let cleared = 0;
  for (let r = 0; r < data.length; r += 1) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      if (cell != null && !shouldPersistCelldataCell(cell)) {
        row[c] = null;
        cleared += 1;
      }
    }
  }
  return cleared;
}

/** Drop sparse celldata entries that should not be persisted. */
export function compactSheetCelldataArray(
  celldata: CellWithRowAndCol[] | null | undefined,
): { next: CellWithRowAndCol[]; removed: number } {
  if (!celldata?.length) {
    return { next: celldata ?? [], removed: 0 };
  }
  const next: CellWithRowAndCol[] = [];
  let removed = 0;
  for (let i = 0; i < celldata.length; i += 1) {
    const entry = celldata[i];
    if (shouldPersistCelldataCell(entry?.v)) {
      next.push(entry);
    } else {
      removed += 1;
    }
  }
  return { next, removed };
}

export function compactInMemorySheets(
  sheets: Sheet[] | null | undefined,
): number {
  if (!sheets?.length) return 0;
  let cleared = 0;
  for (let i = 0; i < sheets.length; i += 1) {
    const sheet = sheets[i];
    if (!sheet) continue;
    if (sheet.data) {
      cleared += compactSheetDataMatrix(sheet.data);
    }
    if (Array.isArray(sheet.celldata)) {
      const { next, removed } = compactSheetCelldataArray(sheet.celldata);
      sheet.celldata = next;
      cleared += removed;
    }
    if (sheet.config?.borderInfo) {
      const next = compactBorderInfo(sheet.config.borderInfo);
      if (next) {
        cleared += sheet.config.borderInfo.length - next.length;
        sheet.config.borderInfo = next;
      }
    }
  }
  return cleared;
}

/** Scan Y.Doc for committed ghosts. Does not mutate — caller applies `changes`. */
export function planYdocCompaction(
  ydoc: Y.Doc,
  dsheetId: string,
): SheetCompactionResult {
  const changes: SheetChangePath[] = [];
  let removedFromYdoc = 0;

  const sheetArray = ydoc.getArray(dsheetId);
  sheetArray.forEach((sheetEntry) => {
    if (!(sheetEntry instanceof Y.Map)) return;
    const sheetId = sheetEntry.get('id');
    if (typeof sheetId !== 'string') return;

    const celldataMap = sheetEntry.get('celldata');
    const staleKeys = collectStaleCelldataKeys(
      celldataMap instanceof Y.Map ? celldataMap : null,
    );
    if (staleKeys.length > 0) {
      removedFromYdoc += staleKeys.length;
      changes.push(...buildCelldataDeleteChanges(sheetId, staleKeys));
    }

    const borderInfo = readConfigBorderInfo(sheetEntry.get('config'));
    const nextBorderInfo = compactBorderInfo(borderInfo ?? undefined);
    if (nextBorderInfo) {
      removedFromYdoc += (borderInfo?.length ?? 0) - nextBorderInfo.length;
      changes.push({
        sheetId,
        path: ['config', 'borderInfo'],
        value: nextBorderInfo,
        type: 'update',
      });
    }
  });

  return { removedFromYdoc, clearedInMemory: 0, changes };
}
