import _ from 'lodash';
import { Context } from '../context';
import type { DefinedName, SingleRange } from '../types';
import { getSheetIndex } from '../utils';
import { getRangetxt } from './cell';
import { changeSheet } from './sheet';
import { normalizeSelection } from './selection';

function newDefinedNameId() {
  return `dn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Excel/Google: names must start with letter/underscore; no spaces; not a cell ref. */
export function isValidDefinedNameIdentifier(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (!/^[A-Za-z_][A-Za-z0-9._]*$/.test(n)) return false;
  // Reject bare A1-style tokens (same idea as Excel name rules).
  if (/^[A-Za-z]+\d+$/i.test(n)) return false;
  if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/i.test(n)) return false;
  return true;
}

export function getDefinedNameDisplayRange(
  ctx: Context,
  dn: DefinedName,
): string {
  return (
    getRangetxt(
      ctx,
      dn.sheetId,
      {
        row: [...dn.range.row] as [number, number],
        column: [...dn.range.column] as [number, number],
      },
      // Force sheet prefix in the list (Google-style `Sheet1!K1:M1`).
      '__named_range_list__',
    ) || ''
  );
}

export function findDefinedNameForSelection(ctx: Context): DefinedName | null {
  const last = _.last(ctx.luckysheet_select_save);
  if (!last?.row?.length || !last?.column?.length) return null;
  const sheetId = ctx.currentSheetId;
  return (
    (ctx.definedNames || []).find(
      (dn) =>
        dn.sheetId === sheetId &&
        dn.range.row[0] === last.row[0] &&
        dn.range.row[1] === last.row[1] &&
        dn.range.column[0] === last.column[0] &&
        dn.range.column[1] === last.column[1],
    ) ?? null
  );
}

export function findDefinedNameByName(
  ctx: Context,
  name: string,
  excludeId?: string,
): DefinedName | null {
  const key = name.trim().toLowerCase();
  return (
    (ctx.definedNames || []).find(
      (dn) =>
        dn.name.toLowerCase() === key &&
        (excludeId == null || dn.id !== excludeId),
    ) ?? null
  );
}

/**
 * Resolve a formula VARIABLE (e.g. `=SUM(Custom)`) to a defined name.
 * Prefers sheet-scoped names matching `formulaSheetId`, then workbook-scoped.
 */
export function resolveDefinedNameForFormula(
  definedNames: DefinedName[] | undefined | null,
  name: string,
  formulaSheetId?: string,
): DefinedName | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const matches = (definedNames || []).filter(
    (dn) => dn.name.toLowerCase() === key,
  );
  if (matches.length === 0) return null;
  if (formulaSheetId) {
    const sheetLocal = matches.find(
      (dn) => dn.scope === 'sheet' && dn.localSheetId === formulaSheetId,
    );
    if (sheetLocal) return sheetLocal;
  }
  return (
    matches.find((dn) => dn.scope !== 'sheet') ?? matches[0] ?? null
  );
}

export function addDefinedName(
  ctx: Context,
  input: {
    name: string;
    sheetId: string;
    range: SingleRange;
    scope?: DefinedName['scope'];
    localSheetId?: string;
  },
): { ok: true; namedRange: DefinedName } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!isValidDefinedNameIdentifier(name)) {
    return {
      ok: false,
      error:
        'Name must start with a letter or underscore, contain no spaces, and cannot look like a cell address.',
    };
  }
  if (findDefinedNameByName(ctx, name)) {
    return { ok: false, error: 'A named range with this name already exists.' };
  }
  if (getSheetIndex(ctx, input.sheetId) == null) {
    return { ok: false, error: 'Sheet not found.' };
  }

  const namedRange: DefinedName = {
    id: newDefinedNameId(),
    name,
    sheetId: input.sheetId,
    range: {
      row: [input.range.row[0], input.range.row[1]],
      column: [input.range.column[0], input.range.column[1]],
    },
    scope: input.scope ?? 'workbook',
    localSheetId: input.localSheetId,
  };

  if (!ctx.definedNames) ctx.definedNames = [];
  ctx.definedNames.push(namedRange);
  scheduleDefinedNamesSync(ctx);
  return { ok: true, namedRange };
}

export function updateDefinedName(
  ctx: Context,
  id: string,
  patch: {
    name?: string;
    sheetId?: string;
    range?: SingleRange;
  },
): { ok: true; namedRange: DefinedName } | { ok: false; error: string } {
  const list = ctx.definedNames || [];
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return { ok: false, error: 'Named range not found.' };

  const current = list[idx];
  const name = (patch.name ?? current.name).trim();
  if (!isValidDefinedNameIdentifier(name)) {
    return {
      ok: false,
      error:
        'Name must start with a letter or underscore, contain no spaces, and cannot look like a cell address.',
    };
  }
  if (findDefinedNameByName(ctx, name, id)) {
    return { ok: false, error: 'A named range with this name already exists.' };
  }

  const sheetId = patch.sheetId ?? current.sheetId;
  if (getSheetIndex(ctx, sheetId) == null) {
    return { ok: false, error: 'Sheet not found.' };
  }

  const range = patch.range ?? current.range;
  const next: DefinedName = {
    ...current,
    name,
    sheetId,
    range: {
      row: [range.row[0], range.row[1]],
      column: [range.column[0], range.column[1]],
    },
  };
  list[idx] = next;
  scheduleDefinedNamesSync(ctx);
  return { ok: true, namedRange: next };
}

export function deleteDefinedName(ctx: Context, id: string): boolean {
  const list = ctx.definedNames || [];
  const next = list.filter((d) => d.id !== id);
  if (next.length === list.length) return false;
  ctx.definedNames = next;
  scheduleDefinedNamesSync(ctx);
  return true;
}

/** Jump to a named range (switch sheet if needed) and select its cells. */
export function selectDefinedName(ctx: Context, id: string): boolean {
  const dn = (ctx.definedNames || []).find((d) => d.id === id);
  if (!dn) return false;

  if (dn.sheetId !== ctx.currentSheetId) {
    ctx.sheetScrollRecord[ctx.currentSheetId] = {
      scrollLeft: ctx.scrollLeft,
      scrollTop: ctx.scrollTop,
      luckysheet_select_status: ctx.luckysheet_select_status,
      luckysheet_select_save: ctx.luckysheet_select_save,
      luckysheet_selection_range: ctx.luckysheet_selection_range,
    };
    changeSheet(ctx, dn.sheetId);
  }

  const selection = normalizeSelection(ctx, [
    {
      row: [dn.range.row[0], dn.range.row[1]],
      column: [dn.range.column[0], dn.range.column[1]],
      row_focus: dn.range.row[0],
      column_focus: dn.range.column[0],
    },
  ]);
  ctx.luckysheet_select_save = selection;

  const sheetIdx = getSheetIndex(ctx, dn.sheetId);
  if (sheetIdx != null) {
    ctx.luckysheetfile[sheetIdx].luckysheet_select_save = selection;
  }
  ctx.sheetScrollRecord[dn.sheetId] = {
    ...(ctx.sheetScrollRecord[dn.sheetId] || {}),
    luckysheet_select_save: selection,
    luckysheet_select_status: false,
  };

  return true;
}

export function openNamedRangesSidebar() {
  document.getElementById('named-ranges-button')?.click();
}

/**
 * Defer Yjs sync until after Immer applies the draft (same pattern as
 * sheet-metadata-hooks). Capture the hook fn — not `ctx.hooks` — so the
 * draft proxy is not read after revoke.
 */
export function scheduleDefinedNamesSync(ctx: Context) {
  const definedNamesChange = ctx.hooks?.definedNamesChange;
  if (!definedNamesChange) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      definedNamesChange();
    });
  });
}

type AxisRange = { row: [number, number]; column: [number, number] };

function shiftAxisOnInsert(
  start: number,
  end: number,
  index: number,
  count: number,
  direction: 'lefttop' | 'rightbottom',
): [number, number] | null {
  let a1 = start;
  let a2 = end;
  if (direction === 'lefttop') {
    if (index <= a1) {
      a1 += count;
      a2 += count;
    } else if (index <= a2) {
      a2 += count;
    }
  } else if (index < a1) {
    a1 += count;
    a2 += count;
  } else if (index < a2) {
    a2 += count;
  }
  if (a2 < a1) return null;
  return [a1, a2];
}

function shiftAxisOnDelete(
  start: number,
  end: number,
  delStart: number,
  delEnd: number,
): [number, number] | null {
  const slen = delEnd - delStart + 1;
  if (end < delStart) return [start, end];
  if (start > delEnd) return [start - slen, end - slen];
  if (start >= delStart && end <= delEnd) return null;

  const before = start < delStart ? ([start, Math.min(end, delStart - 1)] as const) : null;
  const after =
    end > delEnd
      ? ([Math.max(start, delEnd + 1) - slen, end - slen] as const)
      : null;
  if (before && after) return [before[0], after[1]];
  if (before) return [before[0], before[1]];
  if (after) return [after[0], after[1]];
  return null;
}

function shiftSingleRangeOnInsert(
  range: AxisRange,
  type: 'row' | 'column',
  index: number,
  count: number,
  direction: 'lefttop' | 'rightbottom',
): AxisRange | null {
  if (type === 'row') {
    const next = shiftAxisOnInsert(
      range.row[0],
      range.row[1],
      index,
      count,
      direction,
    );
    if (!next) return null;
    return { row: next, column: [...range.column] as [number, number] };
  }
  const next = shiftAxisOnInsert(
    range.column[0],
    range.column[1],
    index,
    count,
    direction,
  );
  if (!next) return null;
  return { row: [...range.row] as [number, number], column: next };
}

function shiftSingleRangeOnDelete(
  range: AxisRange,
  type: 'row' | 'column',
  start: number,
  end: number,
): AxisRange | null {
  if (type === 'row') {
    const next = shiftAxisOnDelete(range.row[0], range.row[1], start, end);
    if (!next) return null;
    return { row: next, column: [...range.column] as [number, number] };
  }
  const next = shiftAxisOnDelete(
    range.column[0],
    range.column[1],
    start,
    end,
  );
  if (!next) return null;
  return { row: [...range.row] as [number, number], column: next };
}

/** Shift named ranges on the given sheet after row/col insert. Returns affected names. */
export function shiftDefinedNamesOnInsert(
  ctx: Context,
  sheetId: string,
  type: 'row' | 'column',
  index: number,
  count: number,
  direction: 'lefttop' | 'rightbottom',
): string[] {
  const list = ctx.definedNames || [];
  if (!list.length) return [];
  const affected: string[] = [];
  let changed = false;
  for (let i = 0; i < list.length; i += 1) {
    const dn = list[i];
    if (dn.sheetId !== sheetId) continue;
    const nextRange = shiftSingleRangeOnInsert(
      dn.range,
      type,
      index,
      count,
      direction,
    );
    if (!nextRange) continue;
    if (
      nextRange.row[0] === dn.range.row[0] &&
      nextRange.row[1] === dn.range.row[1] &&
      nextRange.column[0] === dn.range.column[0] &&
      nextRange.column[1] === dn.range.column[1]
    ) {
      continue;
    }
    list[i] = { ...dn, range: nextRange };
    affected.push(dn.name);
    changed = true;
  }
  if (changed) scheduleDefinedNamesSync(ctx);
  return affected;
}

/** Shift/remove named ranges on the given sheet after row/col delete. */
export function shiftDefinedNamesOnDelete(
  ctx: Context,
  sheetId: string,
  type: 'row' | 'column',
  start: number,
  end: number,
): string[] {
  const list = ctx.definedNames || [];
  if (!list.length) return [];
  const affected: string[] = [];
  const next: DefinedName[] = [];
  for (const dn of list) {
    if (dn.sheetId !== sheetId) {
      next.push(dn);
      continue;
    }
    const nextRange = shiftSingleRangeOnDelete(dn.range, type, start, end);
    if (!nextRange) {
      affected.push(dn.name);
      continue;
    }
    if (
      nextRange.row[0] !== dn.range.row[0] ||
      nextRange.row[1] !== dn.range.row[1] ||
      nextRange.column[0] !== dn.range.column[0] ||
      nextRange.column[1] !== dn.range.column[1]
    ) {
      affected.push(dn.name);
      next.push({ ...dn, range: nextRange });
    } else {
      next.push(dn);
    }
  }
  if (next.length !== list.length || affected.length > 0) {
    ctx.definedNames = next;
    scheduleDefinedNamesSync(ctx);
  }
  return affected;
}

/** Drop named ranges that pointed at a deleted sheet. */
export function removeDefinedNamesForSheet(
  ctx: Context,
  deletedSheetId: string,
): string[] {
  const list = ctx.definedNames || [];
  if (!list.length) return [];
  const removed: string[] = [];
  const next = list.filter((dn) => {
    if (dn.sheetId === deletedSheetId || dn.localSheetId === deletedSheetId) {
      removed.push(dn.name);
      return false;
    }
    return true;
  });
  if (removed.length) {
    ctx.definedNames = next;
    scheduleDefinedNamesSync(ctx);
  }
  return removed;
}
