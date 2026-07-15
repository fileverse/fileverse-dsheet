import _ from 'lodash';
import { Cell } from '../types';

export const CELL_FORMAT_ATTRS = [
  'tb',
  'ht',
  'vt',
  'tr',
  'fs',
  'ff',
  'fc',
  'bl',
  'it',
  'un',
  'cl',
  'bg',
  'ct',
] as const;

export type CellFormatAttr = (typeof CELL_FORMAT_ATTRS)[number];

export function hasCellMeaningfulContent(cell: Cell | string | number | boolean | null | undefined): boolean {
  if (cell == null) return false;
  if (typeof cell !== 'object') {
    return cell !== '';
  }

  const innerV = cell.v;
  if (innerV != null && innerV !== '') return true;
  if (typeof cell.f === 'string' && cell.f.length > 0) return true;
  if (cell.mc != null) {
    // Merge anchor lives in config.merge; shadow cells only reference it.
    if (cell.mc.rs != null || cell.mc.cs != null) return true;
    return false;
  }
  if (cell.hl != null) return true;
  if (typeof cell.m === 'string' && cell.m.length > 0) return true;

  const inline = cell.ct?.s;
  if (Array.isArray(inline) && inline.length > 0) {
    return inline.some((part) => {
      const text = part?.v;
      return text != null && String(text).length > 0;
    });
  }

  return false;
}

export function isFormatOnlyEmptyCell(
  cell: Cell | string | number | boolean | null | undefined,
): boolean {
  if (cell == null || typeof cell !== 'object') return false;
  if (hasCellMeaningfulContent(cell)) return false;
  return CELL_FORMAT_ATTRS.some((key) => {
    if (key === 'ct') return cell.ct != null;
    return (cell as Record<string, unknown>)[key] != null;
  });
}

export function shouldPersistCelldataCell(
  cell: Cell | string | number | boolean | null | undefined,
): boolean {
  if (cell == null) return false;
  if (typeof cell !== 'object') return true;
  return hasCellMeaningfulContent(cell);
}

export function celldataEntryEqual(existing: unknown, next: unknown): boolean {
  if (existing === next) return true;
  if (existing == null || next == null) return false;

  const existingEntry = existing as { r?: number; c?: number; v?: unknown };
  const nextEntry = next as { r?: number; c?: number; v?: unknown };

  return (
    existingEntry.r === nextEntry.r &&
    existingEntry.c === nextEntry.c &&
    _.isEqual(existingEntry.v, nextEntry.v)
  );
}
