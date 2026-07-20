import { Context } from '../context';
import type { Sheet } from '../types';
import { dataToCelldata } from './common';
import { ensureSheetFlowdata } from './sheet';
import { getSheetIdByName, getSheetIndex } from '../utils';

/** Matches sheet-qualified refs in formulas: `Sheet2!A1`, `'My Sheet'!B2`. */
const FORMULA_SHEET_REF_RE = /(?:'((?:[^']|'')*)'|([^'!\s()&+,{}]+))!/g;

type SheetsRequiredDenseCache = {
  activeSheetId: string;
  fingerprint: string;
  required: Set<string>;
};

let sheetsRequiredDenseCache: SheetsRequiredDenseCache | null = null;

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

function toCellKey(sheetId: string, r: number, c: number): string {
  return `${sheetId}:${r}:${c}`;
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

function buildCelldataFormulaMap(
  file: Sheet,
): Map<string, string> | undefined {
  if (!file.celldata?.length) return undefined;
  const map = new Map<string, string>();
  for (const entry of file.celldata) {
    const f = entry.v?.f;
    if (typeof f === 'string') {
      map.set(`${entry.r}:${entry.c}`, f);
    }
  }
  return map.size > 0 ? map : undefined;
}

function readFormulaAt(
  ctx: Context,
  sheetId: string,
  r: number,
  c: number,
  fileHint?: Sheet,
  celldataFormulas?: Map<string, string>,
): string | undefined {
  const file =
    fileHint ??
    (() => {
      const index = getSheetIndex(ctx, sheetId);
      return index != null ? ctx.luckysheetfile[index] : undefined;
    })();
  if (!file) return undefined;

  const fromData = file.data?.[r]?.[c]?.f;
  if (typeof fromData === 'string') return fromData;

  const fromMap = celldataFormulas?.get(`${r}:${c}`);
  if (typeof fromMap === 'string') return fromMap;

  const fromSparse = file.celldata?.find(
    (entry) => entry.r === r && entry.c === c,
  )?.v?.f;
  return typeof fromSparse === 'string' ? fromSparse : undefined;
}

function sheetsRequiredDenseFingerprint(
  ctx: Context,
  activeSheetId: string,
): string {
  const index = getSheetIndex(ctx, activeSheetId);
  const calcLen =
    index != null ? ctx.luckysheetfile[index]?.calcChain?.length ?? 0 : 0;
  let activeDeps = 0;
  let activeWide = 0;
  ctx.formulaCache.depsByCell.forEach((_, originKey) => {
    const origin = parseCellKey(originKey);
    if (origin?.sheetId === activeSheetId) activeDeps += 1;
  });
  ctx.formulaCache.formulasWithWideRangeDeps.forEach((originKey) => {
    const origin = parseCellKey(originKey);
    if (origin?.sheetId === activeSheetId) activeWide += 1;
  });
  let activeRevDepOrigins = 0;
  ctx.formulaCache.revDepsByCell.forEach((dependents, depKey) => {
    const dep = parseCellKey(depKey);
    if (dep?.sheetId !== activeSheetId) return;
    activeRevDepOrigins += dependents.size;
  });
  return `${calcLen}:${activeDeps}:${activeWide}:${activeRevDepOrigins}`;
}

/** Drop cached dense-sheet set (e.g. after structural workbook changes). */
export function invalidateSheetsRequiredDenseCache(): void {
  sheetsRequiredDenseCache = null;
}

function addDepsByCellRefs(
  ctx: Context,
  activeSheetId: string,
  required: Set<string>,
): void {
  ctx.formulaCache.depsByCell.forEach((deps, originKey) => {
    const origin = parseCellKey(originKey);
    if (!origin || origin.sheetId !== activeSheetId) return;
    deps.forEach((depKey) => {
      const dep = parseCellKey(depKey);
      if (dep?.sheetId) required.add(dep.sheetId);
    });
  });
}

/** Keep sheets dense when their formulas depend on cells on the active tab. */
function addRevDepsSheetsForActive(
  ctx: Context,
  activeSheetId: string,
  required: Set<string>,
): void {
  ctx.formulaCache.revDepsByCell.forEach((dependents, depKey) => {
    const dep = parseCellKey(depKey);
    if (!dep || dep.sheetId !== activeSheetId) return;
    dependents.forEach((originKey) => {
      const origin = parseCellKey(originKey);
      if (origin?.sheetId) required.add(origin.sheetId);
    });
  });
}

/** Unevaluated cross-sheet formulas on inactive tabs that point at the active tab. */
function scanSheetsReferencingActive(
  ctx: Context,
  activeSheetId: string,
  required: Set<string>,
): void {
  ctx.luckysheetfile.forEach((file) => {
    if (!file.id || file.id === activeSheetId || required.has(file.id)) return;
    const celldataFormulas = buildCelldataFormulaMap(file);
    let referencesActive = false;
    file.calcChain?.forEach((entry) => {
      if (referencesActive) return;
      const sheetId = entry.id ?? file.id!;
      const formula = readFormulaAt(
        ctx,
        sheetId,
        entry.r,
        entry.c,
        file,
        celldataFormulas,
      );
      if (typeof formula !== 'string' || !formula.includes('!')) return;
      collectSheetIdsFromFormulaText(ctx, formula).forEach((id) => {
        if (id === activeSheetId) referencesActive = true;
      });
    });
    if (referencesActive) required.add(file.id);
  });
}

/**
 * When every cross-sheet formula on the active tab is already in `depsByCell`,
 * regex scanning calcChain is redundant.
 */
function calcChainCrossRefsCoveredByDeps(
  ctx: Context,
  activeSheetId: string,
  file: Sheet,
  celldataFormulas?: Map<string, string>,
): boolean {
  const chain = file.calcChain;
  if (!chain?.length) return true;

  for (const entry of chain) {
    const sheetId = entry.id ?? activeSheetId;
    const formula = readFormulaAt(
      ctx,
      sheetId,
      entry.r,
      entry.c,
      sheetId === activeSheetId ? file : undefined,
      sheetId === activeSheetId ? celldataFormulas : undefined,
    );
    if (typeof formula !== 'string' || !formula.includes('!')) continue;
    if (!ctx.formulaCache.depsByCell.has(toCellKey(sheetId, entry.r, entry.c))) {
      return false;
    }
  }
  return true;
}

function scanSheetFormulasForCrossRefs(
  ctx: Context,
  sheetId: string,
): Set<string> {
  const refs = new Set<string>();
  const index = getSheetIndex(ctx, sheetId);
  if (index == null) return refs;

  const file = ctx.luckysheetfile[index];
  const celldataFormulas = buildCelldataFormulaMap(file);
  const addFromFormula = (f: unknown) => {
    if (typeof f !== 'string' || !f.startsWith('=')) return;
    collectSheetIdsFromFormulaText(ctx, f).forEach((id) => refs.add(id));
  };

  // Only scan registered formula cells — not the full dense grid (O(formulas),
  // not O(rows×cols)). Skip when deps graph already covers cross-sheet refs.
  if (calcChainCrossRefsCoveredByDeps(ctx, sheetId, file, celldataFormulas)) {
    return refs;
  }

  file.calcChain?.forEach((entry: { r: number; c: number; id?: string }) => {
    const entrySheetId = entry.id ?? sheetId;
    const formula = readFormulaAt(
      ctx,
      entrySheetId,
      entry.r,
      entry.c,
      entrySheetId === sheetId ? file : undefined,
      entrySheetId === sheetId ? celldataFormulas : undefined,
    );
    if (formula) addFromFormula(formula);
  });

  return refs;
}

function addWideRangeFormulaRefs(
  ctx: Context,
  activeSheetId: string,
  required: Set<string>,
  file: Sheet,
  celldataFormulas?: Map<string, string>,
): void {
  ctx.formulaCache.formulasWithWideRangeDeps.forEach((originKey) => {
    const origin = parseCellKey(originKey);
    if (!origin || origin.sheetId !== activeSheetId) return;
    const formula = readFormulaAt(
      ctx,
      origin.sheetId,
      origin.r,
      origin.c,
      file,
      celldataFormulas,
    );
    if (formula) {
      collectSheetIdsFromFormulaText(ctx, formula).forEach((id) =>
        required.add(id),
      );
    }
  });
}

function computeSheetsRequiredDense(
  ctx: Context,
  activeSheetId: string,
): Set<string> {
  const required = new Set<string>([activeSheetId]);
  const activeIndex = getSheetIndex(ctx, activeSheetId);
  const activeFile =
    activeIndex != null ? ctx.luckysheetfile[activeIndex] : undefined;
  const celldataFormulas =
    activeFile != null ? buildCelldataFormulaMap(activeFile) : undefined;

  addDepsByCellRefs(ctx, activeSheetId, required);
  addRevDepsSheetsForActive(ctx, activeSheetId, required);

  scanSheetFormulasForCrossRefs(ctx, activeSheetId).forEach((id) =>
    required.add(id),
  );

  scanSheetsReferencingActive(ctx, activeSheetId, required);

  if (activeFile) {
    addWideRangeFormulaRefs(
      ctx,
      activeSheetId,
      required,
      activeFile,
      celldataFormulas,
    );
  }

  return required;
}

/**
 * Sheets that must keep dense `data` while `activeSheetId` is active:
 * the active tab, tabs its formulas read, and tabs with formulas that read it.
 */
export function getSheetsRequiredDense(
  ctx: Context,
  activeSheetId: string,
): Set<string> {
  const fingerprint = sheetsRequiredDenseFingerprint(ctx, activeSheetId);
  if (
    sheetsRequiredDenseCache &&
    sheetsRequiredDenseCache.activeSheetId === activeSheetId &&
    sheetsRequiredDenseCache.fingerprint === fingerprint
  ) {
    return new Set(sheetsRequiredDenseCache.required);
  }

  const required = computeSheetsRequiredDense(ctx, activeSheetId);
  sheetsRequiredDenseCache = {
    activeSheetId,
    fingerprint,
    required,
  };
  return new Set(required);
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
    invalidateSheetsRequiredDenseCache();
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
