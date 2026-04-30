import _ from 'lodash';

import { Context, getFlowdata } from '../context';
import { locale } from '../locale';
import {
  Cell,
  CellMatrix,
  Selection,
  SearchResult,
  GlobalCache,
} from '../types';
import { chatatABC, getRegExpStr, getSheetIndex, isAllowEdit } from '../utils';
import { setCellValue, getRangeByTxt } from './cell';
import { valueShowEs } from './format';
import { execfunction } from './formula';
import { normalizeSelection, scrollToHighlightCell } from './selection';
import { changeSheet } from './sheet';

/** Where find/replace scans on the current sheet (workbook-wide only applies to find-all). */
export type FindSearchScope = 'allSheets' | 'thisSheet' | 'specificRange';

export type ReplaceScope = 'allSheets' | 'thisSheet';

function fullSheetRangeForData(
  flowdata: CellMatrix | undefined,
  sheetRow?: number,
  sheetColumn?: number,
): { row: number[]; column: number[] }[] | null {
  const rowCountFromData = flowdata?.length ?? 0;
  const colCountFromData = flowdata?.[0]?.length ?? 0;

  // Some sheets can have `data` but the first row is missing/empty while `row`/`column` are set.
  const rowCount =
    rowCountFromData > 0 ? rowCountFromData : Math.max(0, sheetRow ?? 0);
  const colCount =
    colCountFromData > 0 ? colCountFromData : Math.max(0, sheetColumn ?? 0);

  if (rowCount <= 0 || colCount <= 0) return null;

  return [
    {
      row: [0, rowCount - 1],
      column: [0, colCount - 1],
    },
  ];
}

/**
 * Return value of {@link searchNext}.
 *
 * @remarks
 * **Semver:** Older releases returned `string | null` from `searchNext` (a localized message, or `null` on success).
 * The object form is a **breaking change** for callers that still expect `string | null`; update them to read
 * {@link SearchNextResult.alertMsg} (and optionally {@link SearchNextResult.matchIndex} /
 * {@link SearchNextResult.matchTotal} for on-sheet scoped search UI).
 */
export type SearchNextResult = {
  /** Localized message for an alert dialog, or `null` when the next/previous hit was selected successfully. */
  alertMsg: string | null;
  /**
   * 0-based index of the selected hit in the current sheet's ordered hit list when
   * `scope` is `thisSheet` or `specificRange` and navigation succeeded; otherwise `0`.
   */
  matchIndex: number;
  /**
   * Size of that hit list for `thisSheet` / `specificRange`; `0` when not applicable (e.g. `allSheets`, errors,
   * or empty search).
   */
  matchTotal: number;
};

/** Outcome of {@link replaceAll} for UI (inline status vs. error message). */
export type ReplaceAllResult =
  | { ok: false; message: string }
  | { ok: true; replaced: number; skipped: number };

/** Full used grid on the active sheet for find/replace on this sheet; `null` if the sheet has no cells. */
export function getFindRangeOnCurrentSheet(
  flowdata: CellMatrix,
): Selection[] | null {
  if (!flowdata.length || !flowdata[0]?.length) return null;
  return [
    {
      row: [0, flowdata.length - 1],
      column: [0, flowdata[0].length - 1],
      row_focus: 0,
      column_focus: 0,
    },
  ];
}

function isFormulaCell(flowdata: CellMatrix, r: number, c: number) {
  const cell = flowdata?.[r]?.[c] as Cell | null | undefined;
  return !!cell?.f;
}

function normalizeForCaseMatch(s: string, caseSensitive: boolean): string {
  return caseSensitive ? s : s.toLowerCase();
}

function compileFindReplaceRegExp(
  searchText: string,
  {
    regCheck,
    caseCheck,
    global,
  }: { regCheck: boolean; caseCheck: boolean; global: boolean },
): RegExp | null {
  const flags = `${global ? 'g' : ''}${caseCheck ? '' : 'i'}`;
  const pattern = regCheck ? searchText : getRegExpStr(searchText);
  try {
    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex => treat as no matches / no-op (per product decision)
    return null;
  }
}

function formulaTextMatches(
  searchText: string,
  formulaText: string,
  {
    wordCheck = false,
    caseCheck = false,
  }: Pick<CheckModes, 'wordCheck' | 'caseCheck'>,
): boolean {
  const s = normalizeForCaseMatch(searchText, !!caseCheck);
  const f = normalizeForCaseMatch(formulaText, !!caseCheck);
  if (wordCheck) return s === f;
  return f.indexOf(s) !== -1;
}

function replaceLiteralAll(
  haystack: string,
  needle: string,
  replacement: string,
  caseSensitive: boolean,
): string {
  if (!needle) return haystack;
  if (caseSensitive) return haystack.split(needle).join(replacement);

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const out: string[] = [];

  let from = 0;
  while (from < haystack.length) {
    const idx = lowerHaystack.indexOf(lowerNeedle, from);
    if (idx === -1) break;
    out.push(haystack.slice(from, idx), replacement);
    from = idx + needle.length;
  }
  out.push(haystack.slice(from));
  return out.join('');
}

function looksLikeFormula(s: string): boolean {
  const t = String(s ?? '').trim();
  return t.startsWith('=') && t.length > 1;
}

function applyFormulaText(
  ctx: Context,
  r: number,
  c: number,
  d: CellMatrix,
  formulaText: string,
): void {
  const computed = execfunction(
    ctx,
    formulaText,
    r,
    c,
    undefined,
    undefined,
    true,
  );
  const cell = (d?.[r]?.[c] ?? {}) as Cell;
  d[r][c] = cell;

  cell.f = computed[2];
  cell.v = computed[1] as Cell['v'];
  // Ensure displayed string stays in sync for renderers that rely on `m`.
  cell.m = valueShowEs(r, c, d).toString();
}

export type HyperlinkMap = Record<
  string,
  { linkType?: string; linkAddress?: string }
>;

function hyperlinkTextForCell(
  hyperlinkMap: HyperlinkMap | undefined,
  r: number,
  c: number,
): string {
  if (!hyperlinkMap) return '';
  const link = hyperlinkMap[`${r}_${c}`];
  if (!link) return '';
  return [link.linkAddress, link.linkType].filter(Boolean).join(' ');
}

function hyperlinkMapForCtx(ctx: Context): HyperlinkMap | undefined {
  const idx = getSheetIndex(ctx, ctx.currentSheetId);
  if (idx == null) return undefined;
  return ctx.luckysheetfile[idx]?.hyperlink as HyperlinkMap | undefined;
}

export interface CheckModes {
  regCheck?: boolean;
  wordCheck?: boolean;
  caseCheck?: boolean;
  /** Also search inside formula strings (cell.f) */
  formulaCheck?: boolean;
  /** Also search sheet hyperlink address/type for the cell */
  linkCheck?: boolean;
}

/** Skip cells in hidden rows/columns (manual hide + filter). */
export type SearchHiddenConfig = {
  rowhidden?: Record<string, number> | null;
  colhidden?: Record<string, number> | null;
};

export function getSearchIndexArr(
  searchText: string,
  range: {
    row: number[];
    column: number[];
  }[],
  flowdata: CellMatrix,
  {
    regCheck = false,
    wordCheck = false,
    caseCheck = false,
    formulaCheck = false,
    linkCheck = false,
  }: CheckModes = {},
  hyperlinkMap?: HyperlinkMap,
  hiddenConfig?: SearchHiddenConfig,
) {
  const compiledReg =
    !wordCheck && regCheck
      ? compileFindReplaceRegExp(searchText, {
          regCheck: true,
          caseCheck: !!caseCheck,
          global: false,
        })
      : null;
  const arr: { r: number; c: number }[] = [];
  const seen: Record<string, boolean> = {};

  for (let s = 0; s < range.length; s += 1) {
    const r1 = range[s].row[0];
    const r2 = range[s].row[1];
    const c1 = range[s].column[0];
    const c2 = range[s].column[1];

    for (let r = r1; r <= r2; r += 1) {
      if (hiddenConfig && hiddenConfig.rowhidden?.[r] != null) continue;
      for (let c = c1; c <= c2; c += 1) {
        if (hiddenConfig && hiddenConfig.colhidden?.[c] != null) continue;
        const cell = flowdata[r][c] as Cell | null | undefined;

        if (cell == null) continue;

        let value = valueShowEs(r, c, flowdata);
        if (value === 0) value = value.toString();
        const valStr = value != null && value !== '' ? value.toString() : '';

        const formulaText: string = formulaCheck ? (cell?.f ?? '') : '';
        const linkText: string =
          linkCheck && hyperlinkMap
            ? hyperlinkTextForCell(hyperlinkMap, r, c)
            : '';

        const hasDisplay = valStr !== '';
        const hasFormula = formulaCheck && formulaText !== '';
        const hasLink = linkText !== '';

        if (!hasDisplay && !hasFormula && !hasLink) continue;

        let matched = false;

        if (wordCheck) {
          if (caseCheck) {
            matched =
              (hasDisplay && searchText === valStr) ||
              (hasFormula && searchText === formulaText) ||
              (hasLink && searchText === linkText);
          } else {
            const lsearch = searchText.toLowerCase();
            matched =
              (hasDisplay && lsearch === valStr.toLowerCase()) ||
              (hasFormula && lsearch === formulaText.toLowerCase()) ||
              (hasLink && lsearch === linkText.toLowerCase());
          }
        } else if (regCheck) {
          const reg = compiledReg;
          if (reg) {
            matched =
              (hasDisplay && valStr.search(reg) !== -1) ||
              (hasFormula && formulaText.search(reg) !== -1) ||
              (hasLink && linkText.search(reg) !== -1);
          }
        } else {
          if (caseCheck) {
            matched =
              (hasDisplay && valStr.indexOf(searchText) !== -1) ||
              (hasFormula && formulaText.indexOf(searchText) !== -1) ||
              (hasLink && linkText.indexOf(searchText) !== -1);
          } else {
            const lsearch = searchText.toLowerCase();
            matched =
              (hasDisplay && valStr.toLowerCase().indexOf(lsearch) !== -1) ||
              (hasFormula &&
                formulaText.toLowerCase().indexOf(lsearch) !== -1) ||
              (hasLink && linkText.toLowerCase().indexOf(lsearch) !== -1);
          }
        }

        const key = `${r}_${c}`;
        if (matched && !(key in seen)) {
          seen[key] = true;
          arr.push({ r, c });
        }
      }
    }
  }

  return arr;
}

/** Use chunked async scan when the active sheet has at least this many rows. */
export const QUICK_SEARCH_ASYNC_ROW_THRESHOLD = 50000;

const QUICK_SEARCH_MODES: CheckModes = {
  caseCheck: false,
  formulaCheck: false,
  regCheck: false,
  wordCheck: false,
  linkCheck: false,
};

export function getQuickSearchHiddenConfig(ctx: Context): SearchHiddenConfig {
  return {
    rowhidden: ctx.config.rowhidden ?? null,
    colhidden: ctx.config.colhidden ?? null,
  };
}

/** Display-only, case-insensitive substring find; skips hidden rows/columns. */
export function getQuickSearchIndexArr(
  ctx: Context,
  searchText: string,
  flowdata: CellMatrix,
): { r: number; c: number }[] {
  if (searchText == null || String(searchText).trim() === '') return [];
  const range = getFindRangeOnCurrentSheet(flowdata);
  if (range == null) return [];
  return getSearchIndexArr(
    searchText,
    range,
    flowdata,
    QUICK_SEARCH_MODES,
    undefined,
    getQuickSearchHiddenConfig(ctx),
  );
}

/** Bounding grid rect for overlay (merged region or single cell). */
export function expandCellRectForMerge(
  ctx: Context,
  r: number,
  c: number,
): { r1: number; r2: number; c1: number; c2: number } {
  const flowdata = getFlowdata(ctx);
  if (!flowdata?.[r]?.[c]) return { r1: r, r2: r, c1: c, c2: c };
  const cell = flowdata[r][c] as { mc?: { r: number; c: number } } | null;
  if (!cell || !('mc' in cell) || cell.mc == null || ctx.config.merge == null) {
    return { r1: r, r2: r, c1: c, c2: c };
  }
  const mergeKey = `${cell.mc.r}_${cell.mc.c}`;
  const mc = ctx.config.merge[mergeKey] as
    | { r: number; c: number; rs: number; cs: number }
    | undefined;
  if (mc == null) return { r1: r, r2: r, c1: c, c2: c };
  return {
    r1: mc.r,
    r2: mc.r + mc.rs - 1,
    c1: mc.c,
    c2: mc.c + mc.cs - 1,
  };
}

export function shouldQuickSearchUseAsync(flowdata: CellMatrix): boolean {
  return flowdata.length >= QUICK_SEARCH_ASYNC_ROW_THRESHOLD;
}

/** Active cell for “find next” stepping (may be empty / non-match). */
function resolveFindNextCursor(
  ctx: Context,
  range: Selection[],
): { r: number; c: number } {
  const last = range[range.length - 1];

  const p = ctx.primaryCellActive;
  if (p) return { r: p.r, c: p.c };

  const sel = ctx.luckysheet_select_save;
  const sLast = sel?.[sel.length - 1];
  if (sLast && !_.isNil(sLast.row_focus) && !_.isNil(sLast.column_focus)) {
    return { r: sLast.row_focus, c: sLast.column_focus };
  }

  return {
    r: Math.min(last.row[0], last.row[1]),
    c: Math.min(last.column[0], last.column[1]),
  };
}

/** Next hit index: advance from current cell; wrap; if current is not a hit, use row-major order. */
function nextSearchHitIndex(
  hits: { r: number; c: number }[],
  curR: number,
  curC: number,
): number {
  if (hits.length === 0) return 0;
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i].r === curR && hits[i].c === curC) {
      return (i + 1) % hits.length;
    }
  }
  for (let i = 0; i < hits.length; i += 1) {
    const { r, c } = hits[i];
    if (r > curR || (r === curR && c > curC)) {
      return i;
    }
  }
  return 0;
}

/** Prev hit index: move backward from current cell; wrap; if current is not a hit, use row-major order. */
function prevSearchHitIndex(
  hits: { r: number; c: number }[],
  curR: number,
  curC: number,
): number {
  if (hits.length === 0) return 0;
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i].r === curR && hits[i].c === curC) {
      return (i - 1 + hits.length) % hits.length;
    }
  }
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const { r, c } = hits[i];
    if (r < curR || (r === curR && c < curC)) {
      return i;
    }
  }
  return hits.length - 1;
}

function hitIndexOfCell(
  hits: { r: number; c: number }[],
  r: number,
  c: number,
): number {
  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i].r === r && hits[i].c === c) return i;
  }
  return -1;
}

function nextSheetIndexWithHits(
  hitsBySheetId: Map<string, { r: number; c: number }[]>,
  sheetIds: string[],
  startIdx: number,
): number | null {
  const n = sheetIds.length;
  if (n <= 1) return null;
  for (let step = 1; step < n; step += 1) {
    const idx = (startIdx + step) % n;
    const id = sheetIds[idx];
    const hits = id ? hitsBySheetId.get(id) : undefined;
    if (hits && hits.length > 0) return idx;
  }
  return null;
}

function prevSheetIndexWithHits(
  hitsBySheetId: Map<string, { r: number; c: number }[]>,
  sheetIds: string[],
  startIdx: number,
): number | null {
  const n = sheetIds.length;
  if (n <= 1) return null;
  for (let step = 1; step < n; step += 1) {
    const idx = (startIdx - step + n) % n;
    const id = sheetIds[idx];
    const hits = id ? hitsBySheetId.get(id) : undefined;
    if (hits && hits.length > 0) return idx;
  }
  return null;
}

/**
 * Finds the next or previous match, updates selection and scroll, and optionally switches sheet when
 * `scope` is `allSheets`.
 *
 * @param specificRange - When `scope` is `specificRange`, restricts the scan to this rectangle on the active sheet.
 * @returns Structured result; see {@link SearchNextResult} and semver note on {@link SearchNextResult} remarks.
 */
export function searchNext(
  ctx: Context,
  searchText: string,
  checkModes: CheckModes,
  scope: FindSearchScope = 'thisSheet',
  direction: 'next' | 'prev' = 'next',
  specificRange?: Selection,
): SearchNextResult {
  const { findAndReplace } = locale(ctx);
  const flowdata = getFlowdata(ctx);
  if (searchText === '' || searchText == null || flowdata == null) {
    return {
      alertMsg: findAndReplace.searchInputTip,
      matchIndex: 0,
      matchTotal: 0,
    };
  }

  if (scope === 'allSheets') {
    const sheetIds = ctx.luckysheetfile.map((s) => s.id ?? '').filter(Boolean);
    const currentSheetId = ctx.currentSheetId;
    const currentSheetIndex = sheetIds.indexOf(currentSheetId);
    const hitsBySheetId = new Map<string, { r: number; c: number }[]>();

    for (const sheet of ctx.luckysheetfile) {
      const sid = sheet.id ?? '';
      if (!sid || !sheet.data) continue;
      const sheetFlowdata = sheet.data as CellMatrix;
      const fullRange = fullSheetRangeForData(
        sheetFlowdata,
        sheet.row,
        sheet.column,
      );
      if (fullRange == null) continue;
      const hits = getSearchIndexArr(
        searchText,
        fullRange,
        sheetFlowdata,
        checkModes,
        sheet.hyperlink as HyperlinkMap | undefined,
      );
      if (hits.length > 0) hitsBySheetId.set(sid, hits);
    }

    if (hitsBySheetId.size === 0) {
      return {
        alertMsg: findAndReplace.noFindTip,
        matchIndex: 0,
        matchTotal: 0,
      };
    }

    // If current sheet isn't found (should be rare), fall back to first sheet with hits.
    const curSheetIdx =
      currentSheetIndex >= 0
        ? currentSheetIndex
        : sheetIds.findIndex((id) => (hitsBySheetId.get(id)?.length ?? 0) > 0);
    const curSheetId = sheetIds[curSheetIdx] ?? currentSheetId;

    const curHits = hitsBySheetId.get(curSheetId) ?? [];

    // Cursor: if we are on the current sheet, use selection cursor; otherwise treat as "before start".
    const { r: curR, c: curC } =
      ctx.currentSheetId === curSheetId
        ? resolveFindNextCursor(ctx, [
            {
              row: [0, Math.max(0, (flowdata?.length ?? 1) - 1)],
              column: [0, Math.max(0, (flowdata?.[0]?.length ?? 1) - 1)],
            },
          ])
        : { r: -1, c: -1 };

    const idxInCur = hitIndexOfCell(curHits, curR, curC);

    let targetSheetId: string | null = null;
    let targetR: number | null = null;
    let targetC: number | null = null;

    if (direction === 'next') {
      if (curHits.length > 0) {
        if (idxInCur >= 0) {
          if (idxInCur + 1 < curHits.length) {
            targetSheetId = curSheetId;
            targetR = curHits[idxInCur + 1]!.r;
            targetC = curHits[idxInCur + 1]!.c;
          }
        } else {
          // Find first hit after cursor within current sheet (no wrap).
          for (let i = 0; i < curHits.length; i += 1) {
            const { r, c } = curHits[i]!;
            if (r > curR || (r === curR && c > curC)) {
              targetSheetId = curSheetId;
              targetR = r;
              targetC = c;
              break;
            }
          }
        }
      }

      if (targetSheetId == null) {
        const nextSheetIdx = nextSheetIndexWithHits(
          hitsBySheetId,
          sheetIds,
          curSheetIdx,
        );
        const sid = nextSheetIdx != null ? sheetIds[nextSheetIdx] : null;
        const hits = sid ? hitsBySheetId.get(sid) : undefined;
        if (!sid || !hits || hits.length === 0) {
          // Only current sheet has hits; fall back to wrap within it.
          const fallback = curHits.length ? curHits[0]! : null;
          if (!fallback)
            return {
              alertMsg: findAndReplace.noFindTip,
              matchIndex: 0,
              matchTotal: 0,
            };
          targetSheetId = curSheetId;
          targetR = fallback.r;
          targetC = fallback.c;
        } else {
          targetSheetId = sid;
          targetR = hits[0]!.r;
          targetC = hits[0]!.c;
        }
      }
    } else {
      if (curHits.length > 0) {
        if (idxInCur >= 0) {
          if (idxInCur - 1 >= 0) {
            targetSheetId = curSheetId;
            targetR = curHits[idxInCur - 1]!.r;
            targetC = curHits[idxInCur - 1]!.c;
          }
        } else {
          // Find last hit before cursor within current sheet (no wrap).
          for (let i = curHits.length - 1; i >= 0; i -= 1) {
            const { r, c } = curHits[i]!;
            if (r < curR || (r === curR && c < curC)) {
              targetSheetId = curSheetId;
              targetR = r;
              targetC = c;
              break;
            }
          }
        }
      }

      if (targetSheetId == null) {
        const prevSheetIdx = prevSheetIndexWithHits(
          hitsBySheetId,
          sheetIds,
          curSheetIdx,
        );
        const sid = prevSheetIdx != null ? sheetIds[prevSheetIdx] : null;
        const hits = sid ? hitsBySheetId.get(sid) : undefined;
        if (!sid || !hits || hits.length === 0) {
          const fallback = curHits.length ? curHits[curHits.length - 1]! : null;
          if (!fallback)
            return {
              alertMsg: findAndReplace.noFindTip,
              matchIndex: 0,
              matchTotal: 0,
            };
          targetSheetId = curSheetId;
          targetR = fallback.r;
          targetC = fallback.c;
        } else {
          const last = hits[hits.length - 1]!;
          targetSheetId = sid;
          targetR = last.r;
          targetC = last.c;
        }
      }
    }

    if (
      targetSheetId == null ||
      targetR == null ||
      targetC == null ||
      targetSheetId === ''
    ) {
      return {
        alertMsg: findAndReplace.noFindTip,
        matchIndex: 0,
        matchTotal: 0,
      };
    }

    if (targetSheetId !== ctx.currentSheetId) {
      // Persist the target selection on the destination sheet before switching.
      // The sheet activation pipeline restores `luckysheet_select_save` from the sheet file,
      // so writing it here prevents a post-switch restore from wiping our highlight.
      const toIdx = getSheetIndex(ctx, targetSheetId);
      if (toIdx != null) {
        ctx.luckysheetfile[toIdx].luckysheet_select_save = [
          {
            row: [targetR, targetR],
            column: [targetC, targetC],
            row_focus: targetR,
            column_focus: targetC,
          },
        ];
      }
      changeSheet(ctx, targetSheetId);
    }

    ctx.luckysheet_select_save = normalizeSelection(ctx, [
      { row: [targetR, targetR], column: [targetC, targetC] },
    ]);
    scrollToHighlightCell(ctx, targetR, targetC);
    return { alertMsg: null, matchIndex: 0, matchTotal: 0 };
  }

  // Resolve the search range: specificRange scope uses the provided range, thisSheet uses full sheet.
  const range =
    scope === 'specificRange' && specificRange != null
      ? [specificRange]
      : getFindRangeOnCurrentSheet(flowdata);

  if (range == null) {
    return { alertMsg: findAndReplace.noFindTip, matchIndex: 0, matchTotal: 0 };
  }

  const searchIndexArr = getSearchIndexArr(
    searchText,
    range,
    flowdata,
    checkModes,
    hyperlinkMapForCtx(ctx),
  );

  if (searchIndexArr.length === 0) {
    return { alertMsg: findAndReplace.noFindTip, matchIndex: 0, matchTotal: 0 };
  }

  const { r: curR, c: curC } = resolveFindNextCursor(ctx, range);
  const count =
    direction === 'prev'
      ? prevSearchHitIndex(searchIndexArr, curR, curC)
      : nextSearchHitIndex(searchIndexArr, curR, curC);
  const nextR = searchIndexArr[count].r;
  const nextC = searchIndexArr[count].c;

  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    {
      row: [nextR, nextR],
      column: [nextC, nextC],
    },
  ]);

  scrollToHighlightCell(ctx, nextR, nextC);

  return {
    alertMsg: null,
    matchIndex: count,
    matchTotal: searchIndexArr.length,
  };
}

export function searchAll(
  ctx: Context,
  searchText: string,
  checkModes: CheckModes,
  scope: FindSearchScope = 'thisSheet',
  specificRange?: Selection,
): SearchResult[] {
  const searchResult: SearchResult[] = [];
  if (searchText === '' || searchText == null) {
    return searchResult;
  }

  if (scope === 'allSheets') {
    // Fix 8: Iterate every sheet
    for (const sheet of ctx.luckysheetfile) {
      if (!sheet.data) continue;
      const sheetFlowdata = sheet.data as CellMatrix;
      const fullRange = fullSheetRangeForData(
        sheetFlowdata,
        sheet.row,
        sheet.column,
      );
      if (fullRange == null) continue;

      const indexArr = getSearchIndexArr(
        searchText,
        fullRange,
        sheetFlowdata,
        checkModes,
        sheet.hyperlink as HyperlinkMap | undefined,
      );

      for (const { r, c } of indexArr) {
        const value_ShowEs = valueShowEs(r, c, sheetFlowdata).toString();
        searchResult.push({
          r,
          c,
          sheetName: sheet.name ?? '',
          sheetId: sheet.id ?? '',
          cellPosition: `${chatatABC(c)}${r + 1}`,
          value: value_ShowEs,
        });
      }
    }

    // Navigate to first result if it's on the current sheet
    const firstOnCurrentSheet = searchResult.find(
      (res) => res.sheetId === ctx.currentSheetId,
    );
    if (firstOnCurrentSheet) {
      ctx.luckysheet_select_save = normalizeSelection(ctx, [
        {
          row: [firstOnCurrentSheet.r, firstOnCurrentSheet.r],
          column: [firstOnCurrentSheet.c, firstOnCurrentSheet.c],
        },
      ]);
    }

    return searchResult;
  }

  // Single-sheet / specific-range mode
  const flowdata = getFlowdata(ctx);
  if (flowdata == null) return searchResult;

  const range =
    scope === 'specificRange' && specificRange != null
      ? [specificRange]
      : getFindRangeOnCurrentSheet(flowdata);
  if (range == null) return searchResult;

  const searchIndexArr = getSearchIndexArr(
    searchText,
    range,
    flowdata,
    checkModes,
    hyperlinkMapForCtx(ctx),
  );

  if (searchIndexArr.length === 0) {
    return searchResult;
  }

  for (let i = 0; i < searchIndexArr.length; i += 1) {
    const value_ShowEs = valueShowEs(
      searchIndexArr[i].r,
      searchIndexArr[i].c,
      flowdata,
    ).toString();

    searchResult.push({
      r: searchIndexArr[i].r,
      c: searchIndexArr[i].c,
      sheetName:
        ctx.luckysheetfile[getSheetIndex(ctx, ctx.currentSheetId) || 0]?.name,
      sheetId: ctx.currentSheetId,
      cellPosition: `${chatatABC(searchIndexArr[i].c)}${searchIndexArr[i].r + 1}`,
      value: value_ShowEs,
    });
  }

  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    {
      row: [searchIndexArr[0].r, searchIndexArr[0].r],
      column: [searchIndexArr[0].c, searchIndexArr[0].c],
    },
  ]);

  return searchResult;
}

export function onSearchDialogMoveStart(
  globalCache: GlobalCache,
  e: MouseEvent,
  container: HTMLDivElement,
) {
  const box = document.getElementById('fortune-search-replace');
  if (!box) return;
  // eslint-disable-next-line prefer-const
  let { top, left, width, height } = box.getBoundingClientRect();
  const rect = container.getBoundingClientRect();
  left -= rect.left;
  top -= rect.top;
  const initialPosition = { left, top, width, height };
  _.set(globalCache, 'searchDialog.moveProps', {
    cursorMoveStartPosition: {
      x: e.pageX,
      y: e.pageY,
    },
    initialPosition,
  });
}

export function onSearchDialogMove(globalCache: GlobalCache, e: MouseEvent) {
  const searchDialog = globalCache?.searchDialog;
  const moveProps = searchDialog?.moveProps;
  if (moveProps == null) return;
  const dialog = document.getElementById('fortune-search-replace');
  const { x: startX, y: startY } = moveProps.cursorMoveStartPosition!;
  let { top, left } = moveProps.initialPosition!;
  left += e.pageX - startX;
  top += e.pageY - startY;
  if (top < 0) top = 0;
  (dialog as HTMLDivElement).style.left = `${left}px`;
  (dialog as HTMLDivElement).style.top = `${top}px`;
}

export function onSearchDialogMoveEnd(globalCache: GlobalCache) {
  _.set(globalCache, 'searchDialog.moveProps', undefined);
}

export function replace(
  ctx: Context,
  searchText: string,
  replaceText: string,
  checkModes: CheckModes,
  specificRange?: Selection,
) {
  const { findAndReplace } = locale(ctx);
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) {
    return findAndReplace.modeTip;
  }

  const flowdata = getFlowdata(ctx);
  if (searchText === '' || searchText == null || flowdata == null) {
    return findAndReplace.searchInputTip;
  }

  const range =
    specificRange != null
      ? [specificRange]
      : getFindRangeOnCurrentSheet(flowdata);
  if (range == null) {
    return findAndReplace.noReplceTip;
  }

  const searchIndexArr = getSearchIndexArr(
    searchText,
    range,
    flowdata,
    checkModes,
    hyperlinkMapForCtx(ctx),
  );

  if (searchIndexArr.length === 0) {
    return findAndReplace.noReplceTip;
  }

  let count = null;

  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  const rf = last?.row_focus;
  const cf = last?.column_focus;

  for (let i = 0; i < searchIndexArr.length; i += 1) {
    if (searchIndexArr[i].r === rf && searchIndexArr[i].c === cf) {
      count = i;
      break;
    }
  }

  if (count == null) {
    if (searchIndexArr.length === 0) {
      return findAndReplace.noMatchTip;
    }

    count = 0;
  }

  const d = flowdata;

  let r;
  let c;
  if (checkModes.wordCheck) {
    r = searchIndexArr[count].r;
    c = searchIndexArr[count].c;
    if (isFormulaCell(d, r, c)) {
      if (!checkModes.formulaCheck) return null;
      const cell = d?.[r]?.[c] as Cell | null | undefined;
      const formulaText = String(cell?.f ?? '');
      if (!formulaTextMatches(searchText, formulaText, checkModes)) return null;
      const nextFormula = replaceText;
      if (looksLikeFormula(nextFormula)) {
        applyFormulaText(ctx, r, c, d, nextFormula);
      } else {
        setCellValue(ctx, r, c, d, nextFormula);
      }
      if (ctx?.hooks?.updateCellYdoc) {
        ctx.hooks.updateCellYdoc([
          {
            sheetId: ctx.currentSheetId,
            path: ['celldata'],
            value: { r, c, v: d?.[r]?.[c] ?? null },
            key: `${r}_${c}`,
            type: 'update',
          },
        ]);
      }
      ctx.luckysheet_select_save = normalizeSelection(ctx, [
        { row: [r, r], column: [c, c] },
      ]);
      scrollToHighlightCell(ctx, r, c);
      return null;
    }

    const v = replaceText;

    setCellValue(ctx, r, c, d, v);
    if (ctx?.hooks?.updateCellYdoc) {
      ctx.hooks.updateCellYdoc([
        {
          sheetId: ctx.currentSheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        },
      ]);
    }
  } else {
    const reg = compileFindReplaceRegExp(searchText, {
      regCheck: !!checkModes.regCheck,
      caseCheck: !!checkModes.caseCheck,
      global: true,
    });

    r = searchIndexArr[count].r;
    c = searchIndexArr[count].c;
    if (isFormulaCell(d, r, c)) {
      if (!checkModes.formulaCheck) return null;
      const cell = d?.[r]?.[c] as Cell | null | undefined;
      const formulaText = String(cell?.f ?? '');
      if (checkModes.regCheck) {
        const matchReg = compileFindReplaceRegExp(searchText, {
          regCheck: true,
          caseCheck: !!checkModes.caseCheck,
          global: false,
        });
        if (!matchReg || formulaText.search(matchReg) === -1) return null;
      } else if (!formulaTextMatches(searchText, formulaText, checkModes)) {
        return null;
      }
      const nextFormula =
        checkModes.regCheck && reg
          ? formulaText.replace(reg, replaceText)
          : replaceLiteralAll(
              formulaText,
              searchText,
              replaceText,
              !!checkModes.caseCheck,
            );
      if (looksLikeFormula(nextFormula)) {
        applyFormulaText(ctx, r, c, d, nextFormula);
      } else {
        setCellValue(ctx, r, c, d, nextFormula);
      }
      if (ctx?.hooks?.updateCellYdoc) {
        ctx.hooks.updateCellYdoc([
          {
            sheetId: ctx.currentSheetId,
            path: ['celldata'],
            value: { r, c, v: d?.[r]?.[c] ?? null },
            key: `${r}_${c}`,
            type: 'update',
          },
        ]);
      }
      ctx.luckysheet_select_save = normalizeSelection(ctx, [
        { row: [r, r], column: [c, c] },
      ]);
      scrollToHighlightCell(ctx, r, c);
      return null;
    }

    if (!reg) return null;
    const v = valueShowEs(r, c, d).toString().replace(reg, replaceText);

    setCellValue(ctx, r, c, d, v);
    if (ctx?.hooks?.updateCellYdoc) {
      ctx.hooks.updateCellYdoc([
        {
          sheetId: ctx.currentSheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        },
      ]);
    }
  }

  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    { row: [r, r], column: [c, c] },
  ]);

  scrollToHighlightCell(ctx, r, c);
  return null;
}

export function replaceAll(
  ctx: Context,
  searchText: string,
  replaceText: string,
  checkModes: CheckModes,
  specificRange?: Selection,
): ReplaceAllResult {
  const { findAndReplace } = locale(ctx);
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) {
    return { ok: false, message: findAndReplace.modeTip };
  }

  const flowdata = getFlowdata(ctx);
  if (searchText === '' || searchText == null || flowdata == null) {
    return { ok: false, message: findAndReplace.searchInputTip };
  }

  const searchRange =
    specificRange != null
      ? [specificRange]
      : getFindRangeOnCurrentSheet(flowdata);
  if (searchRange == null) {
    return { ok: false, message: findAndReplace.noReplceTip };
  }

  const searchIndexArr = getSearchIndexArr(
    searchText,
    searchRange,
    flowdata,
    checkModes,
    hyperlinkMapForCtx(ctx),
  );

  if (searchIndexArr.length === 0) {
    return { ok: false, message: findAndReplace.noReplceTip };
  }

  const d = flowdata;
  const cellChanges: {
    sheetId: string;
    path: string[];
    key?: string;
    value: unknown;
    type?: 'update' | 'delete';
  }[] = [];
  let replaceCount = 0;
  let skippedCount = 0;
  // Track replaced cells for post-replace selection
  const replacedCells: { row: number[]; column: number[] }[] = [];

  if (checkModes.wordCheck) {
    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r } = searchIndexArr[i];
      const { c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) {
        if (!checkModes.formulaCheck) {
          skippedCount += 1;
          continue;
        }
        const cell = d?.[r]?.[c] as Cell | null | undefined;
        const formulaText = String(cell?.f ?? '');
        if (!formulaTextMatches(searchText, formulaText, checkModes)) {
          skippedCount += 1;
          continue;
        }
        const nextFormula = replaceText;
        if (looksLikeFormula(nextFormula)) {
          applyFormulaText(ctx, r, c, d, nextFormula);
        } else {
          setCellValue(ctx, r, c, d, nextFormula);
        }
        if (ctx?.hooks?.updateCellYdoc) {
          cellChanges.push({
            sheetId: ctx.currentSheetId,
            path: ['celldata'],
            value: { r, c, v: d?.[r]?.[c] ?? null },
            key: `${r}_${c}`,
            type: 'update',
          });
        }
        replacedCells.push({ row: [r, r], column: [c, c] });
        replaceCount += 1;
        continue;
      }

      const v = replaceText;

      setCellValue(ctx, r, c, d, v);
      if (ctx?.hooks?.updateCellYdoc) {
        cellChanges.push({
          sheetId: ctx.currentSheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        });
      }

      replacedCells.push({ row: [r, r], column: [c, c] });
      replaceCount += 1;
    }
  } else {
    const reg = compileFindReplaceRegExp(searchText, {
      regCheck: !!checkModes.regCheck,
      caseCheck: !!checkModes.caseCheck,
      global: true,
    });
    if (!reg) {
      // invalid regex => treat as no matches / no-op
      return { ok: false, message: findAndReplace.noReplceTip };
    }

    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r } = searchIndexArr[i];
      const { c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) {
        if (!checkModes.formulaCheck) {
          skippedCount += 1;
          continue;
        }
        const cell = d?.[r]?.[c] as Cell | null | undefined;
        const formulaText = String(cell?.f ?? '');
        if (checkModes.regCheck) {
          const matchReg = compileFindReplaceRegExp(searchText, {
            regCheck: true,
            caseCheck: !!checkModes.caseCheck,
            global: false,
          });
          if (!matchReg || formulaText.search(matchReg) === -1) {
            skippedCount += 1;
            continue;
          }
        } else if (!formulaTextMatches(searchText, formulaText, checkModes)) {
          skippedCount += 1;
          continue;
        }
        const nextFormula = checkModes.regCheck
          ? formulaText.replace(reg, replaceText)
          : replaceLiteralAll(
              formulaText,
              searchText,
              replaceText,
              !!checkModes.caseCheck,
            );
        if (looksLikeFormula(nextFormula)) {
          applyFormulaText(ctx, r, c, d, nextFormula);
        } else {
          setCellValue(ctx, r, c, d, nextFormula);
        }
        if (ctx?.hooks?.updateCellYdoc) {
          cellChanges.push({
            sheetId: ctx.currentSheetId,
            path: ['celldata'],
            value: { r, c, v: d?.[r]?.[c] ?? null },
            key: `${r}_${c}`,
            type: 'update',
          });
        }
        replacedCells.push({ row: [r, r], column: [c, c] });
        replaceCount += 1;
        continue;
      }

      const v = valueShowEs(r, c, d).toString().replace(reg, replaceText);

      setCellValue(ctx, r, c, d, v);
      if (ctx?.hooks?.updateCellYdoc) {
        cellChanges.push({
          sheetId: ctx.currentSheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        });
      }

      replacedCells.push({ row: [r, r], column: [c, c] });
      replaceCount += 1;
    }
  }

  if (cellChanges.length > 0 && ctx?.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(cellChanges);
  }

  if (replacedCells.length > 0) {
    ctx.luckysheet_select_save = normalizeSelection(ctx, replacedCells);
  }

  return { ok: true, replaced: replaceCount, skipped: skippedCount };
}

function replaceAllOnSheetInto(
  ctx: Context,
  sheetId: string,
  sheetFlowdata: CellMatrix,
  searchText: string,
  replaceText: string,
  checkModes: CheckModes,
  searchRange: { row: number[]; column: number[] }[],
  cellChanges: {
    sheetId: string;
    path: string[];
    key?: string;
    value: unknown;
    type?: 'update' | 'delete';
  }[],
  hyperlinkMap?: HyperlinkMap,
): { replaced: number; skipped: number } {
  const searchIndexArr = getSearchIndexArr(
    searchText,
    searchRange,
    sheetFlowdata,
    checkModes,
    hyperlinkMap,
  );
  if (searchIndexArr.length === 0) return { replaced: 0, skipped: 0 };

  const d = sheetFlowdata;
  let replaceCount = 0;
  let skippedCount = 0;

  if (checkModes.wordCheck) {
    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r, c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) {
        if (!checkModes.formulaCheck) {
          skippedCount += 1;
          continue;
        }
        const cell = d?.[r]?.[c] as Cell | null | undefined;
        const formulaText = String(cell?.f ?? '');
        if (!formulaTextMatches(searchText, formulaText, checkModes)) {
          skippedCount += 1;
          continue;
        }
        const nextFormula = replaceText;
        if (looksLikeFormula(nextFormula)) {
          applyFormulaText(ctx, r, c, d, nextFormula);
        } else {
          setCellValue(ctx, r, c, d, nextFormula);
        }
        cellChanges.push({
          sheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        });
        replaceCount += 1;
        continue;
      }

      setCellValue(ctx, r, c, d, replaceText);
      cellChanges.push({
        sheetId,
        path: ['celldata'],
        value: { r, c, v: d?.[r]?.[c] ?? null },
        key: `${r}_${c}`,
        type: 'update',
      });
      replaceCount += 1;
    }
  } else {
    const reg = compileFindReplaceRegExp(searchText, {
      regCheck: !!checkModes.regCheck,
      caseCheck: !!checkModes.caseCheck,
      global: true,
    });
    if (!reg) return { replaced: 0, skipped: 0 };
    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r, c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) {
        if (!checkModes.formulaCheck) {
          skippedCount += 1;
          continue;
        }
        const cell = d?.[r]?.[c] as Cell | null | undefined;
        const formulaText = String(cell?.f ?? '');
        if (checkModes.regCheck) {
          const matchReg = compileFindReplaceRegExp(searchText, {
            regCheck: true,
            caseCheck: !!checkModes.caseCheck,
            global: false,
          });
          if (!matchReg || formulaText.search(matchReg) === -1) {
            skippedCount += 1;
            continue;
          }
        } else if (!formulaTextMatches(searchText, formulaText, checkModes)) {
          skippedCount += 1;
          continue;
        }
        const nextFormula = checkModes.regCheck
          ? formulaText.replace(reg, replaceText)
          : replaceLiteralAll(
              formulaText,
              searchText,
              replaceText,
              !!checkModes.caseCheck,
            );
        if (looksLikeFormula(nextFormula)) {
          applyFormulaText(ctx, r, c, d, nextFormula);
        } else {
          setCellValue(ctx, r, c, d, nextFormula);
        }
        cellChanges.push({
          sheetId,
          path: ['celldata'],
          value: { r, c, v: d?.[r]?.[c] ?? null },
          key: `${r}_${c}`,
          type: 'update',
        });
        replaceCount += 1;
        continue;
      }

      const v = valueShowEs(r, c, d).toString().replace(reg, replaceText);
      setCellValue(ctx, r, c, d, v);
      cellChanges.push({
        sheetId,
        path: ['celldata'],
        value: { r, c, v: d?.[r]?.[c] ?? null },
        key: `${r}_${c}`,
        type: 'update',
      });
      replaceCount += 1;
    }
  }

  return { replaced: replaceCount, skipped: skippedCount };
}

export function replaceAllScoped(
  ctx: Context,
  searchText: string,
  replaceText: string,
  checkModes: CheckModes,
  scope: ReplaceScope = 'thisSheet',
): ReplaceAllResult {
  const { findAndReplace } = locale(ctx);
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return { ok: false, message: findAndReplace.modeTip };
  if (searchText === '' || searchText == null) {
    return { ok: false, message: findAndReplace.searchInputTip };
  }

  if (scope === 'thisSheet') {
    return replaceAll(ctx, searchText, replaceText, checkModes);
  }

  const originalSheetId = ctx.currentSheetId;
  const cellChanges: {
    sheetId: string;
    path: string[];
    key?: string;
    value: unknown;
    type?: 'update' | 'delete';
  }[] = [];
  let replaced = 0;
  let skipped = 0;

  for (const sheet of ctx.luckysheetfile) {
    const sheetId = sheet.id ?? '';
    const sheetData = sheet.data as CellMatrix | undefined;
    if (!sheetId || !sheetData) continue;

    const range = fullSheetRangeForData(sheetData, sheet.row, sheet.column);
    if (range == null) continue;

    // Ensure formula evaluation and any sheet-scoped helpers behave correctly.
    ctx.currentSheetId = sheetId;
    const res = replaceAllOnSheetInto(
      ctx,
      sheetId,
      sheetData,
      searchText,
      replaceText,
      checkModes,
      range,
      cellChanges,
      sheet.hyperlink as HyperlinkMap | undefined,
    );
    replaced += res.replaced;
    skipped += res.skipped;
  }

  ctx.currentSheetId = originalSheetId;

  if (replaced === 0 && skipped === 0) {
    return { ok: false, message: findAndReplace.noReplceTip };
  }

  if (cellChanges.length > 0 && ctx?.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(cellChanges);
  }

  return { ok: true, replaced, skipped };
}

// ---------------------------------------------------------------------------
// Fix 4: Chunked async scan using setTimeout to avoid blocking the main thread
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 500; // rows processed per frame

/**
 * Asynchronously scans `flowdata` for `searchText` in chunks, yielding
 * between chunks so the main thread stays responsive.
 *
 * Returns an AbortController — call `.abort()` to cancel an in-flight scan.
 *
 * @param onProgress - called with partial results after each chunk
 * @param onComplete - called once with the full result array when done
 */
export function getSearchIndexArrAsync(
  searchText: string,
  range: { row: number[]; column: number[] }[],
  flowdata: CellMatrix,
  modes: CheckModes,
  hyperlinkMap?: HyperlinkMap,
  hiddenConfig?: SearchHiddenConfig,
  onProgress?: (partial: { r: number; c: number }[]) => void,
  onComplete?: (all: { r: number; c: number }[]) => void,
): AbortController {
  const controller = new AbortController();
  const { signal } = controller;

  const completion = { done: false };
  const finish = (val: { r: number; c: number }[]) => {
    if (completion.done) return;
    completion.done = true;
    onComplete?.(val);
  };
  signal.addEventListener('abort', () => finish([]), { once: true });

  const arr: { r: number; c: number }[] = [];
  const seen: Record<string, boolean> = {};

  // Normalise optional booleans so downstream checks are always boolean
  const wordCheck = !!modes.wordCheck;
  const regCheck = !!modes.regCheck;
  const caseCheck = !!modes.caseCheck;
  const formulaCheck = !!modes.formulaCheck;
  const linkCheck = !!modes.linkCheck;

  // Hoist RegExp (same logic as getSearchIndexArr)
  let hoistedReg: RegExp | null = null;
  if (!wordCheck && regCheck) {
    try {
      hoistedReg = new RegExp(searchText, modes.caseCheck ? 'g' : 'ig');
    } catch {
      finish([]);
      return controller;
    }
  }

  // Flatten the range into a list of (r1, r2, c1, c2) segments
  type Segment = { r1: number; r2: number; c1: number; c2: number };
  const segments: Segment[] = range.map((rng) => ({
    r1: rng.row[0],
    r2: rng.row[1],
    c1: rng.column[0],
    c2: rng.column[1],
  }));

  let segIdx = 0;
  let currentR = segments[0]?.r1 ?? 0;

  function processChunk() {
    if (signal.aborted) return;
    if (segIdx >= segments.length) {
      finish(arr);
      return;
    }

    let rowsProcessed = 0;

    while (segIdx < segments.length && rowsProcessed < CHUNK_SIZE) {
      const seg = segments[segIdx];

      for (
        ;
        currentR <= seg.r2 && rowsProcessed < CHUNK_SIZE;
        currentR += 1, rowsProcessed += 1
      ) {
        if (!flowdata[currentR]) continue;
        if (hiddenConfig?.rowhidden?.[currentR] != null) continue;

        for (let c = seg.c1; c <= seg.c2; c += 1) {
          if (hiddenConfig?.colhidden?.[c] != null) continue;
          const cell = flowdata[currentR][c] as Cell | null | undefined;
          if (cell == null) continue;

          let value = valueShowEs(currentR, c, flowdata);
          if (value === 0) value = value.toString();
          const valStr = value != null && value !== '' ? value.toString() : '';
          const formulaText = formulaCheck ? (cell?.f ?? '') : '';
          const linkText =
            linkCheck && hyperlinkMap
              ? hyperlinkTextForCell(hyperlinkMap, currentR, c)
              : '';

          const hasDisplay = valStr !== '';
          const hasFormula = formulaCheck && formulaText !== '';
          const hasLink = linkText !== '';
          if (!hasDisplay && !hasFormula && !hasLink) continue;

          let matched = false;

          if (wordCheck) {
            if (caseCheck) {
              matched =
                (hasDisplay && searchText === valStr) ||
                (hasFormula && searchText === formulaText) ||
                (hasLink && searchText === linkText);
            } else {
              const ls = searchText.toLowerCase();
              matched =
                (hasDisplay && ls === valStr.toLowerCase()) ||
                (hasFormula && ls === formulaText.toLowerCase()) ||
                (hasLink && ls === linkText.toLowerCase());
            }
          } else if (regCheck) {
            matched =
              (hasDisplay && valStr.search(hoistedReg!) !== -1) ||
              (hasFormula && formulaText.search(hoistedReg!) !== -1) ||
              (hasLink && linkText.search(hoistedReg!) !== -1);
          } else {
            if (caseCheck) {
              matched =
                (hasDisplay && valStr.indexOf(searchText) !== -1) ||
                (hasFormula && formulaText.indexOf(searchText) !== -1) ||
                (hasLink && linkText.indexOf(searchText) !== -1);
            } else {
              const ls = searchText.toLowerCase();
              matched =
                (hasDisplay && valStr.toLowerCase().indexOf(ls) !== -1) ||
                (hasFormula && formulaText.toLowerCase().indexOf(ls) !== -1) ||
                (hasLink && linkText.toLowerCase().indexOf(ls) !== -1);
            }
          }

          const key = `${currentR}_${c}`;
          if (matched && !(key in seen)) {
            seen[key] = true;
            arr.push({ r: currentR, c });
          }
        }
      }

      if (currentR > seg.r2) {
        segIdx += 1;
        currentR = segments[segIdx]?.r1 ?? 0;
      }
    }

    onProgress?.(arr.slice());
    if (!completion.done && !signal.aborted) {
      setTimeout(processChunk, 0);
    }
  }

  setTimeout(processChunk, 0);
  return controller;
}

/** Chunked quick search with hidden row/column skip (same semantics as `getQuickSearchIndexArr`). */
export function runQuickSearchIndexArrAsync(
  ctx: Context,
  searchText: string,
  flowdata: CellMatrix,
  onProgress: (partial: { r: number; c: number }[]) => void,
  onComplete: (all: { r: number; c: number }[]) => void,
): AbortController {
  const range = getFindRangeOnCurrentSheet(flowdata);
  const noop = new AbortController();
  if (searchText == null || String(searchText).trim() === '' || range == null) {
    setTimeout(() => onComplete([]), 0);
    return noop;
  }
  return getSearchIndexArrAsync(
    searchText,
    range,
    flowdata,
    QUICK_SEARCH_MODES,
    undefined,
    getQuickSearchHiddenConfig(ctx),
    onProgress,
    onComplete,
  );
}

// ---------------------------------------------------------------------------
// Range-scoped find/replace utilities
// ---------------------------------------------------------------------------

/**
 * Parses an A1-notation range string (e.g. "E10:H14" or "Sheet1!E10:H14")
 * into a `Selection` suitable for scoping find/replace.
 *
 * Returns `null` if the text is empty or cannot be parsed.
 * The sheet-name prefix is stripped before parsing — the active sheet is always used.
 */
export function parseRangeText(
  rangeText: string,
  ctx: Context,
): Selection | null {
  if (!rangeText || rangeText.trim() === '') return null;

  // Strip optional sheet prefix (e.g. "Sheet1!" or "'My Sheet'!")
  const stripped = rangeText.trim().replace(/^[^!]+!/, '');

  // Normalise to uppercase for consistent parsing
  const normalised = stripped.toUpperCase();

  try {
    const parsed = getRangeByTxt(ctx, normalised);
    if (!parsed || parsed.length === 0) return null;
    const first = parsed[0];
    if (
      !first ||
      !Array.isArray(first.row) ||
      first.row.length < 2 ||
      !Array.isArray(first.column) ||
      first.column.length < 2
    ) {
      return null;
    }
    return {
      row: [first.row[0], first.row[1]],
      column: [first.column[0], first.column[1]],
    };
  } catch {
    return null;
  }
}
