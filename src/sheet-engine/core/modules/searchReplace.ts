import _ from 'lodash';

import { Context, getFlowdata } from '../context';
import { locale } from '../locale';
import { CellMatrix, Selection, SearchResult, GlobalCache } from '../types';
import {
  chatatABC,
  getRegExpStr,
  getSheetIndex,
  isAllowEdit,
  replaceHtml,
} from '../utils';
import { setCellValue } from './cell';
import { valueShowEs } from './format';
import { normalizeSelection, scrollToHighlightCell } from './selection';

/** Where find/replace scans on the current sheet (workbook-wide only applies to find-all). */
export type FindSearchScope = 'allSheets' | 'thisSheet';

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
  const cell = flowdata?.[r]?.[c] as any;
  return !!cell?.f;
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
) {
  const arr: { r: number; c: number }[] = [];
  const seen: Record<string, boolean> = {};

  for (let s = 0; s < range.length; s += 1) {
    const r1 = range[s].row[0];
    const r2 = range[s].row[1];
    const c1 = range[s].column[0];
    const c2 = range[s].column[1];

    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) {
        const cell = flowdata[r][c] as any;

        if (cell == null) continue;

        let value = valueShowEs(r, c, flowdata);
        if (value === 0) value = (value as any).toString();
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
          let reg: RegExp;
          if (caseCheck) {
            reg = new RegExp(getRegExpStr(searchText), 'g');
          } else {
            reg = new RegExp(getRegExpStr(searchText), 'ig');
          }
          matched =
            (hasDisplay && reg.test(valStr)) ||
            (hasFormula && reg.test(formulaText)) ||
            (hasLink && reg.test(linkText));
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
  if (
    sLast &&
    !_.isNil(sLast.row_focus) &&
    !_.isNil(sLast.column_focus)
  ) {
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

export function searchNext(
  ctx: Context,
  searchText: string,
  checkModes: CheckModes,
) {
  const { findAndReplace } = locale(ctx);
  const flowdata = getFlowdata(ctx);
  if (searchText === '' || searchText == null || flowdata == null) {
    return findAndReplace.searchInputTip;
  }
  const range = getFindRangeOnCurrentSheet(flowdata);
  if (range == null) {
    return findAndReplace.noFindTip;
  }

  const searchIndexArr = getSearchIndexArr(
    searchText,
    range,
    flowdata,
    checkModes,
    hyperlinkMapForCtx(ctx),
  );

  if (searchIndexArr.length === 0) {
    return findAndReplace.noFindTip;
  }

  const { r: curR, c: curC } = resolveFindNextCursor(ctx, range);
  const count = nextSearchHitIndex(searchIndexArr, curR, curC);
  const nextR = searchIndexArr[count].r;
  const nextC = searchIndexArr[count].c;

  ctx.luckysheet_select_save = normalizeSelection(ctx, [
    {
      row: [nextR, nextR],
      column: [nextC, nextC],
    },
  ]);

  scrollToHighlightCell(ctx, nextR, nextC);

  return null;
}

export function searchAll(
  ctx: Context,
  searchText: string,
  checkModes: CheckModes,
  scope: FindSearchScope = 'thisSheet',
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
      if (!sheetFlowdata.length || !sheetFlowdata[0]?.length) continue;

      const fullRange = [
        {
          row: [0, sheetFlowdata.length - 1],
          column: [0, sheetFlowdata[0].length - 1],
        },
      ];

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

  // Single-sheet mode
  const flowdata = getFlowdata(ctx);
  if (flowdata == null) return searchResult;

  const range = getFindRangeOnCurrentSheet(flowdata);
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
      cellPosition: `${chatatABC(searchIndexArr[i].c)}${searchIndexArr[i].r + 1
        }`,
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

  const range = getFindRangeOnCurrentSheet(flowdata);
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
    let reg;
    if (checkModes.caseCheck) {
      reg = new RegExp(getRegExpStr(searchText), 'g');
    } else {
      reg = new RegExp(getRegExpStr(searchText), 'ig');
    }

    r = searchIndexArr[count].r;
    c = searchIndexArr[count].c;
    if (isFormulaCell(d, r, c)) {
      return null;
    }

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

  const range = getFindRangeOnCurrentSheet(flowdata);
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

  const d = flowdata;
  const cellChanges: {
    sheetId: string;
    path: string[];
    key?: string;
    value: any;
    type?: 'update' | 'delete';
  }[] = [];
  let replaceCount = 0;

  if (checkModes.wordCheck) {
    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r } = searchIndexArr[i];
      const { c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) continue;

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

      range.push({ row: [r, r], column: [c, c] });
      replaceCount += 1;
    }
  } else {
    let reg;
    if (checkModes.caseCheck) {
      reg = new RegExp(getRegExpStr(searchText), 'g');
    } else {
      reg = new RegExp(getRegExpStr(searchText), 'ig');
    }

    for (let i = 0; i < searchIndexArr.length; i += 1) {
      const { r } = searchIndexArr[i];
      const { c } = searchIndexArr[i];
      if (isFormulaCell(d, r, c)) continue;

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

      range.push({ row: [r, r], column: [c, c] });
      replaceCount += 1;
    }
  }

  if (cellChanges.length > 0 && ctx?.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc(cellChanges);
  }

  ctx.luckysheet_select_save = normalizeSelection(ctx, range);

  const succeedInfo = replaceHtml(findAndReplace.successTip, {
    xlength: replaceCount,
  });

  return succeedInfo;
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
  onProgress?: (partial: { r: number; c: number }[]) => void,
  onComplete?: (all: { r: number; c: number }[]) => void,
): AbortController {
  const controller = new AbortController();
  const { signal } = controller;

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
      onComplete?.([]);
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
      onComplete?.(arr);
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

        for (let c = seg.c1; c <= seg.c2; c += 1) {
          const cell = flowdata[currentR][c] as any;
          if (cell == null) continue;

          let value = valueShowEs(currentR, c, flowdata);
          if (value === 0) value = (value as any).toString();
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
    setTimeout(processChunk, 0);
  }

  setTimeout(processChunk, 0);
  return controller;
}
