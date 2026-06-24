import type { RefObject } from 'react';
import type { SheetEditorRef } from '../types/comments';

type SheetEditorRefLike = RefObject<SheetEditorRef | null> | null | undefined;

type WorkbookSheetLike = {
  id?: string;
  order?: number;
  name?: string;
};

type WorkbookEditorLike = {
  getSheet?: () => WorkbookSheetLike;
  getAllSheets?: () => WorkbookSheetLike[];
  getWorkbookContext?: () => { luckysheetfile?: unknown[] } | null;
  activateSheet?: (options: { id?: string; index?: number }) => void;
};

const getEditor = (ref: SheetEditorRefLike): WorkbookEditorLike | null =>
  (ref?.current as WorkbookEditorLike | null) ?? null;

export function isWorkbookReady(ref: SheetEditorRefLike): boolean {
  const editor = getEditor(ref);
  if (!editor) return false;
  const fileCount = editor.getWorkbookContext?.()?.luckysheetfile?.length ?? 0;
  return fileCount > 0;
}

export function getCurrentSheetSafe(
  ref: SheetEditorRefLike,
): WorkbookSheetLike | null {
  const editor = getEditor(ref);
  if (!editor?.getSheet) return null;
  try {
    return editor.getSheet() ?? null;
  } catch {
    return null;
  }
}

export function getCurrentSheetOrderSafe(ref: SheetEditorRefLike): number {
  const sheet = getCurrentSheetSafe(ref);
  return typeof sheet?.order === 'number' ? sheet.order : 0;
}

export function getCurrentSheetIdSafe(ref: SheetEditorRefLike): string {
  const sheet = getCurrentSheetSafe(ref);
  // Prefer the immutable UUID; fall back to order-as-string for safety.
  return sheet?.id ?? String(getCurrentSheetOrderSafe(ref));
}

export function getAllSheetsSafe(ref: SheetEditorRefLike): WorkbookSheetLike[] {
  const editor = getEditor(ref);
  if (!editor?.getAllSheets) return [];
  try {
    const sheets = editor.getAllSheets();
    return Array.isArray(sheets) ? sheets : [];
  } catch {
    return [];
  }
}

export function buildSheetOrderNameMap(
  ref: SheetEditorRefLike,
): Map<number, string> {
  const nameMap = new Map<number, string>();
  for (const sheet of getAllSheetsSafe(ref)) {
    if (typeof sheet.order === 'number' && sheet.name) {
      nameMap.set(sheet.order, sheet.name);
    }
  }
  const current = getCurrentSheetSafe(ref);
  if (
    current &&
    typeof current.order === 'number' &&
    current.name &&
    !nameMap.has(current.order)
  ) {
    nameMap.set(current.order, current.name);
  }
  return nameMap;
}

/**
 * Returns a map keyed by BOTH the sheet's immutable id AND its numeric
 * order-as-string so that both new (UUID) and legacy (order) comment keys
 * resolve to the correct display name in a single lookup.
 */
export function buildSheetIdNameMap(
  ref: SheetEditorRefLike,
): Map<string, string> {
  const nameMap = new Map<string, string>();
  for (const sheet of getAllSheetsSafe(ref)) {
    if (!sheet.name) continue;
    if (sheet.id) nameMap.set(sheet.id, sheet.name);
    if (typeof sheet.order === 'number')
      nameMap.set(String(sheet.order), sheet.name);
  }
  return nameMap;
}

export function findSheetById(
  ref: SheetEditorRefLike,
  id: string,
): WorkbookSheetLike | null {
  return getAllSheetsSafe(ref).find((s) => s.id === id) ?? null;
}

export function activateSheetById(
  ref: SheetEditorRefLike,
  id: string,
): boolean {
  const editor = getEditor(ref);
  if (!editor?.activateSheet) return false;
  try {
    editor.activateSheet({ id });
    return true;
  } catch {
    return false;
  }
}

export function findSheetByOrder(
  ref: SheetEditorRefLike,
  order: number,
): WorkbookSheetLike | null {
  return getAllSheetsSafe(ref).find((s) => s.order === order) ?? null;
}

export function activateSheetByOrder(
  ref: SheetEditorRefLike,
  order: number,
): boolean {
  const editor = getEditor(ref);
  if (!editor?.activateSheet) return false;

  const sheet = findSheetByOrder(ref, order);
  if (!sheet?.id) return false;

  try {
    editor.activateSheet({ id: sheet.id });
    return true;
  } catch {
    return false;
  }
}
