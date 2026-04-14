import _ from "lodash";
import { Context, getFlowdata } from "../context";
import { getSheetIndex, isAllowEdit } from "../utils";
import { cancelNormalSelected, mergeBorder } from "./cell";
import { setSelectionByCharacterOffset } from "./cursor";
import { getcellrange, iscelldata } from "./formula";
import {
  applyLinkToSelection,
  convertSpanToShareString,
  getHyperlinksFromInlineSegments,
  isInlineStringCell,
  stripInlineSegmentHyperlinkDecoration,
} from "./inline-string";
import { colLocation, rowLocation } from "./location";
import { normalizeSelection } from "./selection";
import { changeSheet } from "./sheet";
import { locale } from "../locale";
import type { Cell, CellStyle, GlobalCache, HyperlinkEntry } from "../types";

function normalizeEditorPlainText(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function getCellRowColumn(
  ctx: Context,
  e: MouseEvent,
  container: HTMLDivElement,
  scrollX: HTMLDivElement,
  scrollY: HTMLDivElement
) {
  const flowdata = getFlowdata(ctx);
  if (flowdata == null) return undefined;
  const { scrollLeft } = scrollX;
  const { scrollTop } = scrollY;
  const rect = container.getBoundingClientRect();
  let x = e.pageX - rect.left - ctx.rowHeaderWidth;
  let y = e.pageY - rect.top - ctx.columnHeaderHeight;
  x += scrollLeft;
  y += scrollTop;
  let r = rowLocation(y, ctx.visibledatarow)[2];
  let c = colLocation(x, ctx.visibledatacolumn)[2];

  const margeset = mergeBorder(ctx, flowdata, r, c);
  if (margeset) {
    [, , r] = margeset.row;
    [, , c] = margeset.column;
  }

  return { r, c };
}

function normalizeSheetHyperlinkValue(raw: unknown): HyperlinkEntry[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (x) =>
        x &&
        typeof x === "object" &&
        (x as HyperlinkEntry).linkType &&
        (x as HyperlinkEntry).linkAddress
    ) as HyperlinkEntry[];
  }
  if (
    typeof raw === "object" &&
    (raw as HyperlinkEntry).linkType &&
    (raw as HyperlinkEntry).linkAddress
  ) {
    return [raw as HyperlinkEntry];
  }
  return [];
}

function linkEquals(a: HyperlinkEntry, b: HyperlinkEntry) {
  return a.linkType === b.linkType && a.linkAddress === b.linkAddress;
}

export function getCellHyperlinks(ctx: Context, r: number, c: number): HyperlinkEntry[] {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (sheetIndex == null) return [];
  const raw = ctx.luckysheetfile[sheetIndex].hyperlink?.[`${r}_${c}`];
  const fromSheet = normalizeSheetHyperlinkValue(raw);
  if (fromSheet.length > 0) return fromSheet;
  return getHyperlinksFromInlineSegments(getFlowdata(ctx)?.[r]?.[c] ?? undefined);
}

export function getCellHyperlink(ctx: Context, r: number, c: number) {
  return getCellHyperlinks(ctx, r, c)[0];
}

/** Join display text for all inline segments that use this link. */
export function getHyperlinkDisplayTextInCell(
  cell: Cell | null | undefined,
  link: HyperlinkEntry
): string {
  if (cell?.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return "";
  return (cell.ct.s as { link?: HyperlinkEntry; v?: string }[])
    .filter((s) => s.link && linkEquals(s.link, link))
    .map((s) => s.v ?? "")
    .join("");
}

function normalizeInlinePlainSegment(s: string | undefined): string {
  return (s ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Plain-text [start, end) of consecutive inline segments that carry `target`. */
export function getInlineLinkPlainRange(
  cell: Cell | null | undefined,
  target: HyperlinkEntry
): { start: number; end: number } | undefined {
  if (cell?.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return undefined;
  let cursor = 0;
  let start: number | undefined;
  let end: number | undefined;
  for (const seg of cell.ct.s as { v?: string; link?: HyperlinkEntry }[]) {
    const text = normalizeInlinePlainSegment(seg?.v);
    const len = text.length;
    const isMatch = seg?.link && linkEquals(seg.link, target);
    if (isMatch) {
      if (start == null) start = cursor;
      end = cursor + len;
    } else if (start != null) {
      break;
    }
    cursor += len;
  }
  if (start == null || end == null || start === end) return undefined;
  return { start, end };
}

/**
 * If every plain character in [start, end) lies in inline segments that share the same
 * `link`, returns that link; otherwise undefined (mixed/unlinked text in range).
 */
export function getUniformLinkCoveringPlainRange(
  cell: Cell | null | undefined,
  start: number,
  end: number
): HyperlinkEntry | undefined {
  if (start >= end) return undefined;
  if (cell?.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return undefined;
  let cursor = 0;
  let found: HyperlinkEntry | undefined;
  for (const seg of cell.ct.s as { v?: string; link?: HyperlinkEntry }[]) {
    const text = normalizeInlinePlainSegment(seg?.v);
    const len = text.length;
    const segEnd = cursor + len;
    const lo = Math.max(start, cursor);
    const hi = Math.min(end, segEnd);
    if (lo < hi) {
      if (!seg?.link?.linkType || !seg?.link?.linkAddress) return undefined;
      if (found == null) {
        found = seg.link;
      } else if (!linkEquals(found, seg.link)) {
        return undefined;
      }
    }
    cursor = segEnd;
  }
  return found;
}

/** Plain caret offset `pos` lies strictly inside a linked segment (before that segment's end). */
export function getUniformLinkAtPlainOffset(
  cell: Cell | null | undefined,
  pos: number
): HyperlinkEntry | undefined {
  if (cell?.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return undefined;
  let cursor = 0;
  for (const seg of cell.ct.s as { v?: string; link?: HyperlinkEntry }[]) {
    const text = normalizeInlinePlainSegment(seg?.v);
    const len = text.length;
    if (len > 0 && pos >= cursor && pos < cursor + len) {
      if (seg?.link?.linkType && seg?.link?.linkAddress) return seg.link;
      return undefined;
    }
    cursor += len;
  }
  return undefined;
}

function setSheetHyperlinkValue(
  sheetFile: { hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]> },
  r: number,
  c: number,
  links: HyperlinkEntry[]
) {
  const key = `${r}_${c}`;
  if (!sheetFile.hyperlink) sheetFile.hyperlink = {};
  if (links.length === 0) {
    delete sheetFile.hyperlink[key];
  } else if (links.length === 1) {
    sheetFile.hyperlink[key] = links[0];
  } else {
    sheetFile.hyperlink[key] = links;
  }
}

function stripInlineLinkProperties(cell: Cell | null | undefined) {
  if (cell?.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return;
  for (const seg of cell.ct.s) {
    if (!seg || typeof seg !== "object") continue;
    const s = seg as { link?: HyperlinkEntry } & CellStyle;
    if (s.link?.linkType && s.link?.linkAddress) {
      delete s.link;
      stripInlineSegmentHyperlinkDecoration(s);
    }
  }
}

function refreshInlineCellPlainText(cell: Cell) {
  if (cell.ct?.t !== "inlineStr" || !Array.isArray(cell.ct.s)) return;
  const full = (cell.ct.s as { v?: string }[]).map((s) => s.v ?? "").join("");
  cell.v = full;
  cell.m = full;
}

function getCellPlainNormalized(cell: Cell | null | undefined): string {
  if (cell?.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    return normalizeEditorPlainText(
      (cell.ct.s as { v?: string }[]).map((s) => s?.v ?? "").join("")
    );
  }
  if (cell?.v == null || Array.isArray(cell.v)) return "";
  return normalizeEditorPlainText(`${cell.v}`);
}

function splitPlainIntoLinkedSegments(
  plain: string,
  linkStart: number,
  linkEnd: number,
  link: HyperlinkEntry,
  base: CellStyle
): (CellStyle & { v?: string; link?: HyperlinkEntry })[] {
  const out: (CellStyle & { v?: string; link?: HyperlinkEntry })[] = [];
  const baseClean = { ...base };
  const pushPlain = (t: string) => {
    if (!t) return;
    out.push({ ...baseClean, v: t });
  };
  const pushLink = (t: string) => {
    if (!t) return;
    out.push({
      ...baseClean,
      v: t,
      link,
      fc: "rgb(0, 0, 255)",
      un: 1,
    });
  };
  pushPlain(plain.slice(0, linkStart));
  pushLink(plain.slice(linkStart, linkEnd));
  pushPlain(plain.slice(linkEnd));
  return out;
}

/**
 * Apply link to a character range using sheet model only (no contenteditable).
 * Used when the link card opened without entering cell edit (no prior link on target text).
 * Skips cells that already have inline link segments (need editor DOM).
 */
function trySaveHyperlinkSelectionFromModel(
  ctx: Context,
  r: number,
  c: number,
  linkText: string,
  linkType: string,
  linkAddress: string,
  sheetIndex: number,
  flowdata: NonNullable<ReturnType<typeof getFlowdata>>
): boolean {
  const offsets = ctx.linkCard?.selectionOffsets;
  if (!offsets || !linkType || !linkAddress) return false;

  let curv = flowdata[r][c];
  if (curv == null || !_.isPlainObject(curv)) curv = {};
  const cell = curv as Cell;

  if (
    isInlineStringCell(cell) &&
    getHyperlinksFromInlineSegments(cell).length > 0
  ) {
    return false;
  }

  const resolvedDisplay =
    String(linkText ?? "").trim() || String(linkAddress ?? "").trim();
  const effectiveDisplay = normalizeEditorPlainText(resolvedDisplay);
  const fullNorm = getCellPlainNormalized(cell);
  const a = Math.max(0, Math.min(offsets.start, fullNorm.length));
  const b = Math.max(a, Math.min(offsets.end, fullNorm.length));
  const slice = fullNorm.slice(a, b);
  const shouldAppend =
    effectiveDisplay.length > 0 && effectiveDisplay !== slice;
  const insertAnchor =
    typeof ctx.linkCard?.linkInsertOffset === "number"
      ? ctx.linkCard.linkInsertOffset
      : b;
  const insertAt = Math.max(0, Math.min(insertAnchor, fullNorm.length));

  let newPlain: string;
  let linkStart: number;
  let linkEnd: number;
  if (shouldAppend) {
    newPlain =
      fullNorm.slice(0, insertAt) +
      effectiveDisplay +
      fullNorm.slice(insertAt);
    linkStart = insertAt;
    linkEnd = insertAt + effectiveDisplay.length;
  } else {
    newPlain = fullNorm;
    linkStart = a;
    linkEnd = b;
  }

  if (linkEnd <= linkStart) return false;

  const linkEntry: HyperlinkEntry = { linkType, linkAddress };
  const fontSize = cell.fs || 10;
  const base: CellStyle = { fs: fontSize };
  if (cell.ff != null) base.ff = cell.ff;
  if (cell.bl != null) base.bl = cell.bl;
  if (cell.it != null) base.it = cell.it;

  const segments = splitPlainIntoLinkedSegments(
    newPlain,
    linkStart,
    linkEnd,
    linkEntry,
    base
  );

  const next: Cell = {
    ...cell,
    ct: { fa: "General", tb: "1", t: "inlineStr", s: segments },
  };
  delete (next as { f?: unknown }).f;
  delete (next as { hl?: unknown }).hl;
  delete (next as { fc?: unknown }).fc;
  delete (next as { un?: unknown }).un;

  refreshInlineCellPlainText(next);
  const sheetFile = ctx.luckysheetfile[sheetIndex] as {
    hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]>;
  };
  const linkList = getHyperlinksFromInlineSegments(next);
  setSheetHyperlinkValue(sheetFile, r, c, linkList);
  flowdata[r][c] = next;
  pushHyperlinkAndCellYdoc(ctx, r, c, next, sheetFile);
  ctx.linkCard = undefined;
  return true;
}

function pushHyperlinkAndCellYdoc(
  ctx: Context,
  r: number,
  c: number,
  cell: Cell,
  sheetFile: { hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]> }
) {
  if (!ctx?.hooks?.updateCellYdoc) return;
  const key = `${r}_${c}`;
  const hv = sheetFile.hyperlink?.[key];
  ctx.hooks.updateCellYdoc([
    {
      sheetId: ctx.currentSheetId,
      path: ["hyperlink"],
      key,
      value: hv ?? null,
      type: hv == null ? "delete" : "update",
    },
    {
      sheetId: ctx.currentSheetId,
      path: ["celldata"],
      value: { r, c, v: cell },
      key,
      type: "update",
    },
  ]);
}

/** After changing hyperlinks on (r,c), update or close `ctx.linkCard` if it matches. */
export function syncLinkCardAfterHyperlinkChange(ctx: Context, r: number, c: number) {
  const rc = `${r}_${c}`;
  if (ctx.linkCard?.rc !== rc || ctx.linkCard.sheetId !== ctx.currentSheetId) return;
  const links = getCellHyperlinks(ctx, r, c);
  if (links.length === 0) {
    ctx.linkCard = undefined;
    return;
  }
  const cell = getFlowdata(ctx)?.[r]?.[c];
  ctx.linkCard.links = links;
  ctx.linkCard.editingLinkIndex = undefined;
  ctx.linkCard.isEditing = false;
  ctx.linkCard.originType = links[0].linkType;
  ctx.linkCard.originAddress = links[0].linkAddress;
  ctx.linkCard.originText =
    cell?.v != null && !Array.isArray(cell.v) ? `${cell.v}` : "";
}

export function saveHyperlink(
  ctx: Context,
  r: number,
  c: number,
  linkText: string,
  linkType: string,
  linkAddress: string,
  options?: {
    applyToSelection?: boolean;
    cellInput?: HTMLDivElement | null;
    /** When true, apply range from ctx.linkCard using cell data only (no active editor). */
    applySelectionFromModel?: boolean;
  }
) {
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);

  if (
    options?.applySelectionFromModel &&
    sheetIndex != null &&
    flowdata != null &&
    trySaveHyperlinkSelectionFromModel(
      ctx,
      r,
      c,
      linkText,
      linkType,
      linkAddress,
      sheetIndex,
      flowdata
    )
  ) {
    return;
  }

  const applyToSelection = options?.applyToSelection && options?.cellInput;

  if (applyToSelection) {
    if (
      sheetIndex != null &&
      flowdata != null &&
      linkType &&
      linkAddress &&
      options.cellInput
    ) {
      let curv = flowdata[r][c];
      if (curv == null || !_.isPlainObject(curv)) curv = {};
      const editor = options.cellInput;
      const resolvedDisplay =
        String(linkText ?? "").trim() || String(linkAddress ?? "").trim();
      const effectiveDisplay = normalizeEditorPlainText(resolvedDisplay);

      const offsets = ctx.linkCard?.selectionOffsets;
      if (offsets) {
        const fullNorm = normalizeEditorPlainText(
          editor.innerText ?? editor.textContent ?? ""
        );
        const a = Math.max(0, Math.min(offsets.start, fullNorm.length));
        const b = Math.max(a, Math.min(offsets.end, fullNorm.length));
        const slice = fullNorm.slice(a, b);
        const shouldAppend =
          effectiveDisplay.length > 0 && effectiveDisplay !== slice;
        const insertAnchor =
          typeof ctx.linkCard?.linkInsertOffset === "number"
            ? ctx.linkCard.linkInsertOffset
            : b;
        const insertAt = Math.max(0, Math.min(insertAnchor, fullNorm.length));

        editor.focus({ preventScroll: true });
        if (shouldAppend) {
          setSelectionByCharacterOffset(editor, insertAt, insertAt);
          document.execCommand(
            "insertText",
            false,
            effectiveDisplay.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
          );
          const insLen = effectiveDisplay.length;
          setSelectionByCharacterOffset(editor, insertAt, insertAt + insLen);
        } else {
          setSelectionByCharacterOffset(editor, offsets.start, offsets.end);
        }
      } else {
        editor.focus({ preventScroll: true });
      }
      applyLinkToSelection(editor, linkType, linkAddress);

      const fontSize = (curv as Cell).fs || 10;
      if (!(curv as Cell).ct) {
        (curv as Cell).ct = { fa: "General", tb: "1" };
      }
      (curv as Cell).ct!.t = "inlineStr";
      (curv as Cell).ct!.s = convertSpanToShareString(
        options.cellInput.querySelectorAll("span"),
        curv as Cell
      );
      delete (curv as Cell).f;
      delete (curv as Cell).hl;
      (curv as Cell).fs = fontSize;
      refreshInlineCellPlainText(curv as Cell);

      const sheetFile = ctx.luckysheetfile[sheetIndex] as {
        hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]>;
      };
      const linkList = getHyperlinksFromInlineSegments(curv as Cell);
      setSheetHyperlinkValue(sheetFile, r, c, linkList);
      flowdata[r][c] = curv as Cell;
      pushHyperlinkAndCellYdoc(ctx, r, c, curv as Cell, sheetFile);
    }
    ctx.linkCard = undefined;
    return;
  }
  if (options?.cellInput) {
    cancelNormalSelected(ctx);
  }

  if (sheetIndex != null && flowdata != null && linkType && linkAddress) {
    let cell = flowdata[r][c];
    if (cell == null) cell = {};
    _.set(ctx.luckysheetfile[sheetIndex], ["hyperlink", `${r}_${c}`], {
      linkType,
      linkAddress,
    });
    cell.fc = "rgb(0, 0, 255)";
    cell.un = 1;
    cell.v = linkText || linkAddress;
    cell.m = linkText || linkAddress;
    cell.hl = { r, c, id: ctx.currentSheetId };
    flowdata[r][c] = cell;
    ctx.linkCard = undefined;
    if (ctx?.hooks?.updateCellYdoc) {
      ctx?.hooks?.updateCellYdoc([
        {
          sheetId: ctx.currentSheetId,
          path: ["celldata"],
          value: {
            r,
            c,
            v: cell,
          },
          key: `${r}_${c}`,
          type: "update",
        },
      ]);
    }
  }
}

export function removeHyperlink(ctx: Context, r: number, c: number) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);
  let updatedCell: any = null;
  if (flowdata != null && sheetIndex != null) {
    const hyperlink = _.omit(
      ctx.luckysheetfile[sheetIndex].hyperlink,
      `${r}_${c}`
    );
    _.set(ctx.luckysheetfile[sheetIndex], "hyperlink", hyperlink);
    const cell = flowdata[r][c];
    if (cell != null) {
      stripInlineLinkProperties(cell);
      delete flowdata[r][c]?.hl;
      delete flowdata[r][c]?.un;
      delete flowdata[r][c]?.fc;
      updatedCell = flowdata[r][c];
    }
  }
  ctx.linkCard = undefined;

  if (ctx?.hooks?.updateCellYdoc) {
    const changes: any[] = [
      {
        sheetId: ctx.currentSheetId,
        path: ["hyperlink"],
        key: `${r}_${c}`,
        value: null,
        type: "delete",
      },
    ];
    if (updatedCell != null) {
      changes.push({
        sheetId: ctx.currentSheetId,
        path: ["celldata"],
        value: { r, c, v: updatedCell },
        key: `${r}_${c}`,
        type: "update",
      });
    }
    ctx.hooks.updateCellYdoc(changes);
  }
}

/** Remove one distinct hyperlink (inline segment link or sheet map entry). */
export function removeHyperlinkForLink(
  ctx: Context,
  r: number,
  c: number,
  target: HyperlinkEntry
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);
  if (flowdata == null || sheetIndex == null) return;

  const sheetFile = ctx.luckysheetfile[sheetIndex] as {
    hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]>;
  };
  const key = `${r}_${c}`;
  const cell = flowdata[r][c];
  if (cell == null) return;

  if (cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    for (const seg of cell.ct.s as { link?: HyperlinkEntry; v?: string }[]) {
      if (seg.link && linkEquals(seg.link, target)) {
        delete seg.link;
        stripInlineSegmentHyperlinkDecoration(seg as CellStyle);
      }
    }
    refreshInlineCellPlainText(cell as Cell);
    const nextLinks = getHyperlinksFromInlineSegments(cell as Cell);
    setSheetHyperlinkValue(sheetFile, r, c, nextLinks);
    pushHyperlinkAndCellYdoc(ctx, r, c, cell as Cell, sheetFile);
    syncLinkCardAfterHyperlinkChange(ctx, r, c);
    return;
  }

  const list = normalizeSheetHyperlinkValue(sheetFile.hyperlink?.[key]);
  const next = list.filter((l) => !linkEquals(l, target));
  if (next.length === list.length) return;

  if (next.length === 0) {
    removeHyperlink(ctx, r, c);
    return;
  }
  setSheetHyperlinkValue(sheetFile, r, c, next);
  if (ctx?.hooks?.updateCellYdoc) {
    ctx.hooks.updateCellYdoc([
      {
        sheetId: ctx.currentSheetId,
        path: ["hyperlink"],
        key,
        value: next.length === 1 ? next[0] : next,
        type: "update",
      },
    ]);
  }
  syncLinkCardAfterHyperlinkChange(ctx, r, c);
}

/** Update URL/type (and display text when a single segment carries this link). */
export function updateHyperlinkForLink(
  ctx: Context,
  r: number,
  c: number,
  target: HyperlinkEntry,
  linkText: string,
  linkType: string,
  linkAddress: string
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit) return;
  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  const flowdata = getFlowdata(ctx);
  if (flowdata == null || sheetIndex == null) return;

  const sheetFile = ctx.luckysheetfile[sheetIndex] as {
    hyperlink?: Record<string, HyperlinkEntry | HyperlinkEntry[]>;
  };
  const key = `${r}_${c}`;
  const cell = flowdata[r][c];
  if (cell == null) return;

  if (cell.ct?.t === "inlineStr" && Array.isArray(cell.ct.s)) {
    const matched = (cell.ct.s as { link?: HyperlinkEntry; v?: string }[]).filter(
      (s) => s.link && linkEquals(s.link, target)
    );
    const nextLink: HyperlinkEntry = { linkType, linkAddress };
    for (const seg of cell.ct.s as { link?: HyperlinkEntry; v?: string }[]) {
      if (seg.link && linkEquals(seg.link, target)) {
        seg.link = nextLink;
      }
    }
    if (matched.length === 1 && linkText.trim()) {
      matched[0].v = linkText;
    }
    refreshInlineCellPlainText(cell as Cell);
    const nextLinks = getHyperlinksFromInlineSegments(cell as Cell);
    setSheetHyperlinkValue(sheetFile, r, c, nextLinks);
    pushHyperlinkAndCellYdoc(ctx, r, c, cell as Cell, sheetFile);
    syncLinkCardAfterHyperlinkChange(ctx, r, c);
    return;
  }

  const list = normalizeSheetHyperlinkValue(sheetFile.hyperlink?.[key]);
  const idx = list.findIndex((l) => linkEquals(l, target));
  if (idx < 0) return;
  const next = [...list];
  next[idx] = { linkType, linkAddress };
  setSheetHyperlinkValue(sheetFile, r, c, next);
  if (cell && typeof cell === "object") {
    (cell as Cell).v = linkText || linkAddress;
    (cell as Cell).m = linkText || linkAddress;
  }
  if (ctx?.hooks?.updateCellYdoc) {
    const changes: any[] = [
      {
        sheetId: ctx.currentSheetId,
        path: ["hyperlink"],
        key,
        value: next.length === 1 ? next[0] : next,
        type: "update",
      },
    ];
    if (cell != null) {
      changes.push({
        sheetId: ctx.currentSheetId,
        path: ["celldata"],
        value: { r, c, v: cell },
        key,
        type: "update",
      });
    }
    ctx.hooks.updateCellYdoc(changes);
  }
  syncLinkCardAfterHyperlinkChange(ctx, r, c);
}

export function showLinkCard(
  ctx: Context,
  r: number,
  c: number,
  options?: {
    applyToSelection?: boolean;
    originText?: string;
    selectionOffsets?: { start: number; end: number };
    linkInsertOffset?: number;
    /** URL/type defaults when inserting but selection (or cell) already maps to one link */
    prefillLink?: HyperlinkEntry;
    /**
     * In-cell edit: show view-only card for this hyperlink (caret / selection inside that
     * linked run in the contenteditable). Suppresses whole-cell hover list.
     */
    caretViewLink?: HyperlinkEntry;
  },
  isEditing = false,
  isMouseDown = false
) {
  const isCellEditingActiveForThisCell =
    (ctx.luckysheetCellUpdate?.length ?? 0) === 2 &&
    ctx.luckysheetCellUpdate[0] === r &&
    ctx.luckysheetCellUpdate[1] === c;
  const caretViewLink = options?.caretViewLink;
  // In-cell edit: ignore passive hover/mousemove (no caretViewLink). Do **not** clear
  // `linkCard` here — that was racing selectionchange and caused the caret view card to blink.
  if (isCellEditingActiveForThisCell && !isEditing && !caretViewLink) {
    return;
  }
  if (ctx.linkCard?.selectingCellRange && !isEditing) return;
  // Allow reopening for the same cell when adding a link to a new text selection (insert flow).
  // Also allow same-cell refresh on mouse-down; otherwise click can close card (outside handler)
  // but this early return prevents immediate re-open until mouse moves.
  if (
    `${r}_${c}` === ctx.linkCard?.rc &&
    !options?.applyToSelection &&
    !isMouseDown &&
    !isEditing &&
    !caretViewLink
  ) {
    return;
  }
  const links = getCellHyperlinks(ctx, r, c);
  const link = links[0];
  const cell = getFlowdata(ctx)?.[r]?.[c];
  const insertingOnSelection = !!options?.applyToSelection;
  if (
    !isEditing &&
    link == null &&
    !caretViewLink &&
    (isMouseDown ||
      !ctx.linkCard?.isEditing ||
      ctx.linkCard.sheetId !== ctx.currentSheetId)
  ) {
    ctx.linkCard = undefined;
    return;
  }
  if (
    isEditing ||
    (link != null && (!ctx.linkCard?.isEditing || isMouseDown)) ||
    (caretViewLink != null &&
      isCellEditingActiveForThisCell &&
      !isEditing) ||
    ctx.linkCard?.sheetId !== ctx.currentSheetId
  ) {
    const col_pre = c - 1 === -1 ? 0 : ctx.visibledatacolumn[c - 1];
    const row = ctx.visibledatarow[r];
    const originText = (() => {
      if (options?.originText !== undefined) return options.originText;
      if (caretViewLink && cell) {
        const disp = getHyperlinkDisplayTextInCell(cell, caretViewLink);
        if (disp.length > 0) return disp;
      }
      if (cell?.v == null) return "";
      return `${cell.v}`;
    })();
    // Insert-on-selection: do not reuse existing cell links (would open "edit first link" and
    // route save to updateHyperlinkForLink instead of saveHyperlink).
    const linkForDefaults =
      insertingOnSelection || isEditing
        ? undefined
        : caretViewLink ?? link;
    const linksForCard = insertingOnSelection || isEditing
      ? undefined
      : caretViewLink
        ? [caretViewLink]
        : links.length > 0
          ? links
          : undefined;
    ctx.linkCard = {
      sheetId: ctx.currentSheetId,
      r,
      c,
      rc: `${r}_${c}`,
      originText,
      originType:
        options?.prefillLink?.linkType ??
        linkForDefaults?.linkType ??
        "webpage",
      originAddress:
        options?.prefillLink?.linkAddress ??
        linkForDefaults?.linkAddress ??
        "",
      links: linksForCard,
      editingLinkIndex: undefined,
      position: {
        cellLeft: col_pre,
        cellBottom: row,
      },
      isEditing,
      applyToSelection: options?.applyToSelection ?? false,
      selectionOffsets: options?.selectionOffsets,
      linkInsertOffset: options?.linkInsertOffset,
    };
  }
}

export function goToLink(
  ctx: Context,
  r: number,
  c: number,
  linkType: string,
  linkAddress: string,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement
) {
  const currSheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (currSheetIndex == null) return;
  if (getCellHyperlinks(ctx, r, c).length === 0) return;
  if (linkType === "webpage") {
    if (!/^http[s]?:\/\//.test(linkAddress)) {
      linkAddress = `https://${linkAddress}`;
    }
    window.open(linkAddress);
  } else if (linkType === "sheet") {
    let sheetId;
    _.forEach(ctx.luckysheetfile, (f) => {
      if (linkAddress === f.name) {
        sheetId = f.id;
      }
    });
    if (sheetId != null) changeSheet(ctx, sheetId);
  } else {
    const range = _.cloneDeep(getcellrange(ctx, linkAddress));
    if (range == null) return;
    const row_pre =
      range.row[0] - 1 === -1 ? 0 : ctx.visibledatarow[range.row[0] - 1];
    const col_pre =
      range.column[0] - 1 === -1
        ? 0
        : ctx.visibledatacolumn[range.column[0] - 1];
    scrollbarX.scrollLeft = col_pre;
    scrollbarY.scrollLeft = row_pre;
    ctx.luckysheet_select_save = normalizeSelection(ctx, [range]);
    changeSheet(ctx, range.sheetId);
  }
  ctx.linkCard = undefined;
}

export function isLinkValid(
  ctx: Context,
  linkType: string,
  linkAddress: string
) {
  if (!linkAddress) return { isValid: false, tooltip: "" };
  const { insertLink } = locale(ctx);
  // prepend https:// if missing
  if (!/^https?:\/\//i.test(linkAddress)) {
    linkAddress = `https://${linkAddress}`;
  }

  // general URL pattern (protocol + domain + optional port/path/query/hash)
  const urlPattern = /^(https?):\/\/[^\s$.?#].[^\s]*$/i;

  const isValid = urlPattern.test(linkAddress);

  if (!isValid) {
    return { isValid: false, tooltip: insertLink.tooltipInfo1 };
  }
  if (linkType === "cellrange" && !iscelldata(linkAddress)) {
    return { isValid: false, tooltip: insertLink.invalidCellRangeTip };
  }
  return { isValid: true, tooltip: "" };
}

export function onRangeSelectionModalMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent
) {
  const box = document.querySelector(
    "div.fortune-link-modify-modal.range-selection-modal"
  ) as HTMLDivElement;
  if (!box) return;
  const { width, height } = box.getBoundingClientRect();
  const left = box.offsetLeft;
  const top = box.offsetTop;
  const initialPosition = { left, top, width, height };
  _.set(globalCache, "linkCard.rangeSelectionModal", {
    cursorMoveStartPosition: {
      x: e.pageX,
      y: e.pageY,
    },
    initialPosition,
  });
}

export function onRangeSelectionModalMove(
  globalCache: GlobalCache,
  e: MouseEvent
) {
  const moveProps = globalCache.linkCard?.rangeSelectionModal;
  if (moveProps == null) return;
  const modal = document.querySelector(
    "div.fortune-link-modify-modal.range-selection-modal"
  );
  const { x: startX, y: startY } = moveProps.cursorMoveStartPosition!;
  let { top, left } = moveProps.initialPosition!;
  left += e.pageX - startX;
  top += e.pageY - startY;
  if (top < 0) top = 0;
  (modal as HTMLDivElement).style.left = `${left}px`;
  (modal as HTMLDivElement).style.top = `${top}px`;
}

export function onRangeSelectionModalMoveEnd(globalCache: GlobalCache) {
  _.set(globalCache, "linkCard.rangeSelectionModal", undefined);
}
