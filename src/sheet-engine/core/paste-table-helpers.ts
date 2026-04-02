/* eslint-disable no-plusplus */
import _ from "lodash";
import { Context } from "./context";
import { locale } from "./locale";
import { getQKBorder, saveHyperlink } from "./modules";
import { Cell } from "./types";
import { getSheetIndex } from "./utils";
import { setRowHeight, setColumnWidth } from "./api";
import { adjustFormulaForPaste } from "./events/paste";

export const DEFAULT_FONT_SIZE = 12;

const parseStylesheetPairs = (styleInner: string) => {
  const patternReg = /{([^}]*)}/g;
  const patternStyle = styleInner.match(patternReg);
  const nameReg = /^[^\t].*/gm;
  const patternName = _.initial(styleInner.match(nameReg));
  if (
    typeof patternStyle !== typeof patternName ||
    patternName.length !== patternStyle?.length
  )
    return {} as Record<string, string>;

  return _.fromPairs(_.zip(patternName, patternStyle));
};

const parseInlineStyleBlock = (block?: string) => {
  if (!block) return {} as Record<string, string>;
  const trimmed = block.substring(1, block.length - 1); // remove { }
  const entries = trimmed
    .split("\n\t")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Record<string, string> = {};
  entries.forEach((entry) => {
    const [k, v] = entry.split(":");
    if (k && v) out[k] = v.replace(";", "").trim();
  });
  return out;
};

const mapFontFamilyToIndex = (ff: string, ctx: Context) => {
  const families = ff.split(",");
  const locale_fontjson = locale(ctx).fontjson as Record<string, number>;
  const found = families
    .map((raw) => raw.trim().toLowerCase())
    .find((key) => {
      const mapped = locale_fontjson[key];
      return mapped != null;
    });
  if (found != null) return locale_fontjson[found];
  return 0; // default font index
};

function applyBordersAndMerges(
  td: HTMLTableCellElement,
  startRow: number,
  startCol: number,
  absRow: number,
  absCol: number,
  rowSpanCount: number,
  colSpanCount: number,
  borderInfo: any,
  data: any[][]
) {
  // Pre-compute border configs once
  const topBorder =
    td.style.borderTop && !td.style.borderTop.startsWith("0px")
      ? getQKBorder(
          td.style.borderTopWidth,
          td.style.borderTopStyle,
          td.style.borderTopColor
        )
      : null;

  const bottomBorder =
    td.style.borderBottom && !td.style.borderBottom.startsWith("0px")
      ? getQKBorder(
          td.style.borderBottomWidth,
          td.style.borderBottomStyle,
          td.style.borderBottomColor
        )
      : null;

  const leftBorder =
    td.style.borderLeft && !td.style.borderLeft.startsWith("0px")
      ? getQKBorder(
          td.style.borderLeftWidth,
          td.style.borderLeftStyle,
          td.style.borderLeftColor
        )
      : null;

  const rightBorder =
    td.style.borderRight && !td.style.borderRight.startsWith("0px")
      ? getQKBorder(
          td.style.borderRightWidth,
          td.style.borderRightStyle,
          td.style.borderRightColor
        )
      : null;

  for (let rowOffset = 0; rowOffset < rowSpanCount; rowOffset++) {
    const relativeRow = startRow + rowOffset;

    for (let colOffset = 0; colOffset < colSpanCount; colOffset++) {
      const relativeCol = startCol + colOffset;

      // mark merge reference (skip the anchor cell)
      if (!(rowOffset === 0 && colOffset === 0)) {
        data[relativeRow][relativeCol] = { mc: { r: absRow, c: absCol } };
      }

      // Only apply borders at perimeter cells
      const isTopEdge = rowOffset === 0;
      const isBottomEdge = rowOffset === rowSpanCount - 1;
      const isLeftEdge = colOffset === 0;
      const isRightEdge = colOffset === colSpanCount - 1;

      if (!(isTopEdge || isBottomEdge || isLeftEdge || isRightEdge)) continue;

      const borderKey = `${relativeRow}_${relativeCol}`;
      borderInfo[borderKey] ||= {};

      if (isTopEdge && topBorder) {
        borderInfo[borderKey].t = { style: topBorder[0], color: topBorder[1] };
      }
      if (isBottomEdge && bottomBorder) {
        borderInfo[borderKey].b = {
          style: bottomBorder[0],
          color: bottomBorder[1],
        };
      }
      if (isLeftEdge && leftBorder) {
        borderInfo[borderKey].l = {
          style: leftBorder[0],
          color: leftBorder[1],
        };
      }
      if (isRightEdge && rightBorder) {
        borderInfo[borderKey].r = {
          style: rightBorder[0],
          color: rightBorder[1],
        };
      }
    }
  }
}
interface BuiltCellResult {
  cell: Cell;
  rowspan: number;
  colspan: number;
  hyperlink?: { href: string; display: string } | null;
  srcRow?: number;
  srcCol?: number;
}

const HEX_REGEX = /^0x?[a-fA-F0-9]+$/;

const detectHyperlink = (td: HTMLTableCellElement) => {
  const anchor = td.querySelector("a[href]") as HTMLAnchorElement | null;
  const urlRegex = /^(https?:\/\/[^\s]+)$/i;
  if (anchor) {
    const href = anchor.getAttribute("href")?.trim() || "";
    const display = anchor.textContent?.trim() || href;
    if (href && urlRegex.test(href)) return { href, display };
  } else {
    const raw = (td.textContent || "").trim();
    if (urlRegex.test(raw)) return { href: raw, display: raw };
  }
  return null;
};

function brToNewline(str: string) {
  return str.replace(/<br\s*\/?>/gi, "\n");
}

const buildCellFromTd = (
  td: HTMLTableCellElement,
  classStyles: Record<string, string>,
  ctx: Context
): BuiltCellResult => {
  const fortuneCellAttr = td.getAttribute("data-fortune-cell");
  if (fortuneCellAttr) {
    try {
      const { _srcRow, _srcCol, ...parsed } = JSON.parse(
        decodeURIComponent(fortuneCellAttr)
      );
      const cell = parsed as Cell;
      delete cell.mc;
      delete cell.hl;
      const rowspan = parseInt(td.getAttribute("rowspan") || "1", 10);
      const colspan = parseInt(td.getAttribute("colspan") || "1", 10);
      return {
        cell,
        rowspan: Number.isNaN(rowspan) ? 1 : rowspan,
        colspan: Number.isNaN(colspan) ? 1 : colspan,
        hyperlink: detectHyperlink(td),
        srcRow: _srcRow,
        srcCol: _srcCol,
      };
    } catch {
      // fall through to CSS parsing if JSON is malformed
    }
  }

  let cell: Cell = {};
  const rawText = (td.innerText || td.innerHTML || "").trim();
  const isLineBreak = rawText.includes("<br />");

  if (!rawText) {
    cell.v = undefined;
    cell.m = "";
  } else if (isLineBreak) {
    const value = brToNewline(rawText);
    cell = { ...cell, ct: { ...cell.ct, t: "inlineStr", s: [{ v: value }] } };
  } else {
    // Store as plain text without auto-detecting date/currency/percentage formats,
    // matching the behaviour of the plain-text paste path in pasteHandler.
    cell.v = rawText;
    cell.m = rawText;
    cell.ct = { fa: "General", t: "g" };
    if (HEX_REGEX.test(rawText)) {
      cell.ct = { fa: "@", t: "s" };
    }
  }

  if (td.style?.alignItems === "center") {
    cell.vt = 0;
  } else if (td.style?.alignItems === "flex-end") {
    cell.vt = 2;
  } else if (td.style?.alignItems === "flex-start") {
    cell.vt = 1;
  }

  const styleBlock =
    typeof classStyles[`.${td.className}`] === "string"
      ? classStyles[`.${td.className}`]
      : "";
  const styles = parseInlineStyleBlock(styleBlock);

  if (!_.isNil(styles.border)) td.style.border = styles.border;

  // Background
  let bg: string | undefined = (td.style.backgroundColor ||
    styles.background) as string | undefined;
  if (!bg || bg === "rgba(0, 0, 0, 0)") bg = undefined;
  cell.bg = bg;

  // Bold / Italic
  const { fontWeight } = td.style;
  cell.bl =
    (fontWeight.toString() === "400" ||
      fontWeight === "normal" ||
      _.isEmpty(fontWeight)) &&
    !_.includes(styles["font-style"], "bold") &&
    (!styles["font-weight"] || styles["font-weight"] === "400")
      ? 0
      : 1;
  cell.it =
    (td.style.fontStyle === "normal" || _.isEmpty(td.style.fontStyle)) &&
    !_.includes(styles["font-style"], "italic")
      ? 0
      : 1;

  // Underline / strike
  cell.un = !_.includes(styles["text-decoration"], "underline") ? undefined : 1;
  cell.cl = !_.includes(td.innerHTML, "<s>") ? undefined : 1;

  // Font family / size / color
  const ff = td.style.fontFamily || styles["font-family"] || "";
  cell.ff = mapFontFamilyToIndex(ff, ctx);
  const fontSize = Math.round(
    styles["font-size"]
      ? parseInt(styles["font-size"].replace("pt", ""), 10)
      : parseInt(td.style.fontSize || `${DEFAULT_FONT_SIZE}`, 10)
  );
  cell.fs = fontSize;
  cell.fc = td.style.color || styles.color;

  // Horizontal align
  const ht = td.style.textAlign || styles["text-align"] || "left";
  if (ht === "center") {
    cell.ht = 0;
  } else if (ht === "right") {
    cell.ht = 2;
  } else {
    cell.ht = 1;
  }

  // const regex = /vertical-align:\s*(.*?);/;

  // // Vertical align
  // const vtStyle =
  //   (typeof classStyles.td === "string" &&
  //     (classStyles.td.match(regex)?.[1] ?? "")) ||
  //   "top";
  // const vt = td.style.verticalAlign || styles["vertical-align"] || vtStyle;
  // if (vt === "middle") {
  //   cell.vt = 0;
  // } else if (vt === "top" || vt === "text-top") {
  //   cell.vt = 1;
  // } else {
  //   cell.vt = 2;
  // }

  // @ts-ignore
  if (td?.style?.["overflow-wrap"] === "anywhere") {
    cell.tb = "2";
  } else {
    cell.tb = "2";
  }

  // Rotation
  if ("mso-rotate" in styles) cell.rt = parseFloat(styles["mso-rotate"]);

  // Span
  let rowspan = parseInt(td.getAttribute("rowspan") || "1", 10);
  let colspan = parseInt(td.getAttribute("colspan") || "1", 10);
  if (Number.isNaN(rowspan)) rowspan = 1;
  if (Number.isNaN(colspan)) colspan = 1;

  return { cell, rowspan, colspan, hyperlink: detectHyperlink(td) };
};

export function handlePastedTable(
  ctx: Context,
  html: string,
  pasteHandler: (context: Context, data: any, borderInfo?: any) => void
) {
  if (!html.includes("table")) return;

  const containerDiv = document.createElement("div");
  containerDiv.innerHTML = html;

  const tableColGropup = containerDiv.querySelectorAll("colgroup");

  tableColGropup.forEach((colGroup, index) => {
    const colWidth = colGroup?.getAttribute("width");
    const intColWidth = parseInt(colWidth || "0", 10);
    const anchorCol = ctx.luckysheet_select_save![0].column[0];
    const absoluteCol = anchorCol + index;
    setColumnWidth(ctx, { [absoluteCol]: intColWidth });
  });

  const tableRows = containerDiv.querySelectorAll("table tr");
  if (tableRows.length === 0) {
    containerDiv.remove();
    return;
  }

  let totalColumns = 0;
  tableRows[0].querySelectorAll("td, th").forEach((cellEl) => {
    const tableCell = cellEl as HTMLTableCellElement;
    const span = Number.isNaN(tableCell.colSpan) ? 1 : tableCell.colSpan;
    totalColumns += span;
  });

  const totalRows = tableRows.length;
  const pastedMatrix: any[][] = Array.from(
    { length: totalRows },
    () => new Array(totalColumns)
  );
  const pasteBorderInfo: any = {};

  const inlineStyleBlock =
    containerDiv.querySelectorAll("style")[0]?.innerHTML || "";
  const classStyleMap = parseStylesheetPairs(inlineStyleBlock);

  const sheetIndex = getSheetIndex(ctx, ctx.currentSheetId);
  if (_.isNil(sheetIndex)) {
    ctx.luckysheet_selection_range = [];
    pasteHandler(ctx, pastedMatrix, pasteBorderInfo);
    containerDiv.remove();
    return;
  }

  const sheetFile = ctx.luckysheetfile[sheetIndex];
  if (!sheetFile.config) sheetFile.config = {};
  if (!sheetFile.config.rowlen)
    sheetFile.config.rowlen = {} as Record<number, number>;
  const rowHeightsConfig = sheetFile.config.rowlen as Record<number, number>;

  let localRowIndex = 0;
  tableRows.forEach((tr) => {
    let localColIndex = 0;

    const anchorRow = ctx.luckysheet_select_save![0].row[0];
    const targetRowIndex = anchorRow + localRowIndex;

    const explicitRowHeightAttr = tr.getAttribute("height");
    if (!_.isNil(explicitRowHeightAttr)) {
      const explicitRowHeight = parseInt(explicitRowHeightAttr, 10);
      const hasCustomRowHeight = _.has(
        sheetFile.config?.rowlen,
        targetRowIndex
      );
      const currentRowHeight = hasCustomRowHeight
        ? sheetFile.config!.rowlen![targetRowIndex]
        : sheetFile.defaultRowHeight;

      if (currentRowHeight !== explicitRowHeight) {
        rowHeightsConfig[targetRowIndex] = explicitRowHeight;
      }

      setRowHeight(ctx, {
        [String(targetRowIndex)]: explicitRowHeight,
      });
    }
    tr.querySelectorAll("td, th").forEach((node) => {
      const tdElement = node as HTMLTableCellElement;

      while (
        localColIndex < totalColumns &&
        pastedMatrix[localRowIndex][localColIndex] != null
      ) {
        localColIndex++;
      }
      if (localColIndex === totalColumns) return; // row overflow

      const { cell, rowspan, colspan, hyperlink, srcRow, srcCol } =
        buildCellFromTd(tdElement, classStyleMap, ctx);

      const anchorCol = ctx.luckysheet_select_save![0].column[0];
      const absoluteRow = anchorRow + localRowIndex;
      const absoluteCol = anchorCol + localColIndex;

      if (cell.f && srcRow != null && srcCol != null) {
        try {
          cell.f = adjustFormulaForPaste(
            cell.f,
            srcCol,
            srcRow,
            absoluteCol,
            absoluteRow
          );
        } catch {
          // invalid ref — leave formula as-is
        }
      }

      // Place cell into matrix
      pastedMatrix[localRowIndex][localColIndex] = cell;

      // Persist hyperlink if present
      if (hyperlink) {
        saveHyperlink(
          ctx,
          absoluteRow,
          absoluteCol,
          hyperlink.href,
          "webpage",
          hyperlink.display
        );
        // Force blue color and underline for all pasted links
        cell.hl = { r: absoluteRow, c: absoluteCol, id: ctx.currentSheetId };
        cell.fc = "rgb(0, 0, 255)";
        cell.un = 1;
        // Update the cell in the matrix with the styling
        pastedMatrix[localRowIndex][localColIndex] = cell;
      }

      // Apply borders and merges
      applyBordersAndMerges(
        tdElement,
        localRowIndex,
        localColIndex,
        absoluteRow,
        absoluteCol,
        rowspan,
        colspan,
        pasteBorderInfo,
        pastedMatrix
      );

      // Mark merged cell metadata, if any
      if (rowspan > 1 || colspan > 1) {
        (pastedMatrix[localRowIndex][localColIndex] as any).mc = {
          rs: rowspan,
          cs: colspan,
          r: absoluteRow,
          c: absoluteCol,
        };
      }

      localColIndex++;
    });

    localRowIndex++;
  });

  ctx.luckysheet_selection_range = [];

  pasteHandler(ctx, pastedMatrix, pasteBorderInfo);
  containerDiv.remove();
}
