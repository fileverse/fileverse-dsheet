import * as Y from 'yjs';
import type { CellMatrix, CellWithRowAndCol, Sheet } from '../../sheet-engine/core/types';
import { shouldPersistCelldataCell } from '../../sheet-engine/core/utils/cell-persist-utils';
import type { SheetChangePath } from './update-ydoc';

export const CELLDATA_COMPACT_STORAGE_KEY_PREFIX = 'dsheet-celldata-compact-v1:';

export type CelldataCompactionResult = {
  removedFromYdoc: number;
  clearedInMemory: number;
  changes: SheetChangePath[];
};

export function celldataCompactStorageKey(dsheetId: string): string {
  return `${CELLDATA_COMPACT_STORAGE_KEY_PREFIX}${dsheetId}`;
}

export function hasCelldataCompactionCompleted(dsheetId: string): boolean {
  if (typeof window === 'undefined' || !dsheetId) return true;
  try {
    return window.localStorage.getItem(celldataCompactStorageKey(dsheetId)) === '1';
  } catch {
    return true;
  }
}

export function markCelldataCompactionCompleted(dsheetId: string): void {
  if (typeof window === 'undefined' || !dsheetId) return;
  try {
    window.localStorage.setItem(celldataCompactStorageKey(dsheetId), '1');
  } catch {
    // ignore quota / privacy mode
  }
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
  }
  return cleared;
}

/**
 * Scan Y.Doc for committed celldata ghosts. Does not mutate — caller applies
 * `changes` via `updateYdocSheetData`.
 */
export function planYdocCelldataCompaction(
  ydoc: Y.Doc,
  dsheetId: string,
): CelldataCompactionResult {
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
    if (staleKeys.length === 0) return;

    removedFromYdoc += staleKeys.length;
    changes.push(...buildCelldataDeleteChanges(sheetId, staleKeys));
  });

  return { removedFromYdoc, clearedInMemory: 0, changes };
}
