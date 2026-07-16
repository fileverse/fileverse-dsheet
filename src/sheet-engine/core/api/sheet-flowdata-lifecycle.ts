import { Context } from '../context';
import { dataToCelldata } from './common';
import { ensureSheetFlowdata } from './sheet';
import { getSheetIdByName, getSheetIndex } from '../utils';

/** Matches sheet-qualified refs in formulas: `Sheet2!A1`, `'My Sheet'!B2`. */
const FORMULA_SHEET_REF_RE = /(?:'((?:[^']|'')*)'|([^'!\s()&+,{}]+))!/g;

function parseCellKey(
  key: string,
): { sheetId: string; r: number; c: number } | null {
  const first = key.indexOf(':');
  const second = key.indexOf(':', first + 1);
  if (first === -1 || second === -1) return null;
  const sheetId = key.slice(0, first);
  const r = Number(key.slice(first + 1, second));
  const c = Number(key.slice(second + 1));
  if (!sheetId || Number.isNaN(r) || Number.isNaN(c)) return null;
  return { sheetId, r, c };
}

function collectSheetIdsFromFormulaText(
  ctx: Context,
  formula: string,
): Set<string> {
  const ids = new Set<string>();
  if (!formula?.includes('!')) return ids;
  FORMULA_SHEET_REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FORMULA_SHEET_REF_RE.exec(formula)) !== null) {
    const rawName =
      match[1] != null ? match[1].replace(/''/g, "'") : match[2];
    if (!rawName) continue;
    const id = getSheetIdByName(ctx, rawName);
    if (id) ids.add(id);
  }
  return ids;
}

function readFormulaAt(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
): string | undefined {
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return undefined;
  const file = ctx.luckysheetfile[index];
  const fromData = file.data?.[r]?.[c]?.f;
  if (typeof fromData === 'string') return fromData;
  const fromSparse = file.celldata?.find(
    (entry) => entry.r === r && entry.c === c,
  )?.v?.f;
  return typeof fromSparse === 'string' ? fromSparse : undefined;
}

function scanSheetFormulasForCrossRefs(
  ctx: Context,
  sheetId: string,
): Set<string> {
  const refs = new Set<string>();
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return refs;

  const file = ctx.luckysheetfile[index];
  const addFromFormula = (f: unknown) => {
    if (typeof f !== 'string' || !f.startsWith('=')) return;
    collectSheetIdsFromFormulaText(ctx, f).forEach((id) => refs.add(id));
  };

  // Only scan registered formula cells — not the full dense grid (O(formulas),
  // not O(rows×cols)). Unevaluated formulas are still on calcChain; evaluated
  // ones are also in depsByCell (walked separately).
  file.calcChain?.forEach((entry: { r: number; c: number; id?: string }) => {
    const formula = readFormulaAt(ctx, entry.id ?? sheetId, entry.r, entry.c);
    if (formula) addFromFormula(formula);
  });

  return refs;
}

/**
 * Sheets that must keep dense `data` while `activeSheetId` is active:
 * the active tab plus any tab referenced by its formulas (deps graph + text scan).
 */
export function getSheetsRequiredDense(
  ctx: Context,
  activeSheetId: string,
): Set<string> {
  const required = new Set<string>([activeSheetId]);

  ctx.formulaCache.depsByCell.forEach((deps, originKey) => {
    const origin = parseCellKey(originKey);
    if (!origin || origin.sheetId !== activeSheetId) return;
    deps.forEach((depKey) => {
      const dep = parseCellKey(depKey);
      if (dep?.sheetId) required.add(dep.sheetId);
    });
  });

  scanSheetFormulasForCrossRefs(ctx, activeSheetId).forEach((id) =>
    required.add(id),
  );

  ctx.formulaCache.formulasWithWideRangeDeps.forEach((originKey) => {
    const origin = parseCellKey(originKey);
    if (!origin || origin.sheetId !== activeSheetId) return;
    const formula = readFormulaAt(
      ctx,
      origin.sheetId,
      origin.r,
      origin.c,
    );
    if (formula) {
      collectSheetIdsFromFormulaText(ctx, formula).forEach((id) =>
        required.add(id),
      );
    }
  });

  return required;
}

/** Sheets the formula worker needs dense — active refs plus any tab with formulas. */
export function getSheetsNeededForWorkerSnapshot(ctx: Context): Set<string> {
  const required = getSheetsRequiredDense(ctx, ctx.currentSheetId);

  ctx.luckysheetfile.forEach((file) => {
    if (!file.id) return;
    if (file.calcChain?.length) {
      required.add(file.id);
    }
  });

  ctx.formulaCache.depsByCell.forEach((_, originKey) => {
    const origin = parseCellKey(originKey);
    if (origin?.sheetId) required.add(origin.sheetId);
  });

  return required;
}

export function demoteSheetToCelldata(ctx: Context, sheetId: string): void {
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return;
  const sheet = ctx.luckysheetfile[index];
  if (!sheet?.data) return;
  sheet.celldata = dataToCelldata(sheet.data);
  delete sheet.data;
}

/**
 * On tab switch: persist outgoing config, demote tabs not needed dense,
 * hydrate active tab + cross-sheet references.
 */
export function syncAndDemoteInactiveFlowdata(
  ctx: Context,
  activeSheetId: string,
  previousSheetId: string | null,
): Set<string> {
  if (previousSheetId && previousSheetId !== activeSheetId) {
    const prevIdx = getSheetIndex(ctx, previousSheetId);
    if (prevIdx != null) {
      ctx.luckysheetfile[prevIdx].config = ctx.config;
    }
  }

  const required = getSheetsRequiredDense(ctx, activeSheetId);

  ctx.luckysheetfile.forEach((sheet) => {
    if (sheet.id && sheet.data && !required.has(sheet.id)) {
      demoteSheetToCelldata(ctx, sheet.id);
    }
  });

  required.forEach((id) => {
    ensureSheetFlowdata(ctx, { id });
  });

  return required;
}
