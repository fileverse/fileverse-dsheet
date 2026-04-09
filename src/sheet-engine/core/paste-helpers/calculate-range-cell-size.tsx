/* eslint-disable no-plusplus */
import { DEFAULT_FONT_SIZE } from "../paste-table-helpers";
import { getSheetIndex } from "../utils";
import { Context, getFlowdata } from "../context";
import { Cell, Sheet } from "../types";
import { setRowHeight } from "../api";

const DEFAULT_FONT_FAMILY =
  "Helvetica Neue, system-ui, Roboto, Lato, Segoe UI, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Arial, sans-serif";

const getColumnWidth = (colIndex: number, ctx: Context, sheetFile: Sheet) => {
  const defaultColumnWidth = ctx.defaultcollen ?? 73;
  return (
    (sheetFile.config?.columnlen as Record<number, number> | undefined)?.[
    colIndex
    ] ?? defaultColumnWidth
  );
};

const getCellDisplayText = (cell: Cell | null | undefined) => {
  let text = cell?.m ?? cell?.v;
  if (text == null && cell?.ct?.t === "inlineStr") {
    text = (cell.ct.s || []).map((s: any) => s.v).join("");
  }
  return text == null ? "" : String(text);
};

const isCellWrapped = (cell: Cell | null | undefined) =>
  Number(cell?.tb) === 2 ||
  cell?.ct?.t === "inlineStr" ||
  /[\r\n]/.test(getCellDisplayText(cell));

const applyFontOnMeasurer = (
  cell: Cell | null | undefined,
  cellSizeMeasurer: HTMLDivElement | null
) => {
  const fontSizePx = (cell?.fs as number | undefined) ?? DEFAULT_FONT_SIZE;
  const fontFamily = (cell?.ff as string | undefined) ?? DEFAULT_FONT_FAMILY;
  const fontWeight = cell?.bl === 1 ? "700" : "400";
  const fontStyle = cell?.it === 1 ? "italic" : "normal";

  cellSizeMeasurer!.style.fontSize = `${fontSizePx}px`;
  cellSizeMeasurer!.style.fontFamily = fontFamily;
  cellSizeMeasurer!.style.fontWeight = fontWeight;
  cellSizeMeasurer!.style.fontStyle = fontStyle;

  return fontSizePx;
};

export function calculateRangeCellSize(
  ctx: Context,
  sheetId: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  maxColumnWidth = 1200
) {
  const sheetIndex = getSheetIndex(ctx, sheetId)!;
  const sheetFile = ctx.luckysheetfile[sheetIndex];
  const gridData = getFlowdata(ctx) || sheetFile.data;

  const maxRowHeights: Record<number, number> = {};
  const maxColumnWidths: Record<number, number> = {};

  let cellSizeMeasurer = document.getElementById(
    "fs-cell-measurer"
  ) as HTMLDivElement | null;
  if (!cellSizeMeasurer) {
    cellSizeMeasurer = document.createElement("div");
    cellSizeMeasurer.id = "fs-cell-measurer";
    Object.assign(cellSizeMeasurer.style, {
      position: "fixed",
      left: "-99999px",
      top: "-99999px",
      visibility: "hidden",
      lineHeight: "1.3",
      whiteSpace: "normal",
      wordBreak: "normal",
      overflowWrap: "break-word",
    });
    document.body.appendChild(cellSizeMeasurer);
  }

  const defaultRowHeight = sheetFile.defaultRowHeight ?? 19;

  // First, calculate max widths for each column
  for (let col = startCol; col <= endCol; col++) {
    let requiredWidth = getColumnWidth(col, ctx, sheetFile);

    for (let row = startRow; row <= endRow; row++) {
      const cell = gridData?.[row]?.[col];
      if (cell?.mc && cell.mc.rs == null) continue;

      const text = getCellDisplayText(cell);
      applyFontOnMeasurer(cell, cellSizeMeasurer);
      cellSizeMeasurer!.style.whiteSpace = "pre";
      cellSizeMeasurer!.style.width = "auto";
      cellSizeMeasurer!.textContent = text;
      const intrinsicWidth = Math.ceil(cellSizeMeasurer!.scrollWidth + 12);
      if (intrinsicWidth > requiredWidth) requiredWidth = intrinsicWidth;
    }

    maxColumnWidths[col] = Math.min(requiredWidth, maxColumnWidth);
  }

  // Then, calculate max heights for each row based on the determined column widths
  for (let row = startRow; row <= endRow; row++) {
    let requiredHeight = defaultRowHeight;

    for (let col = startCol; col <= endCol; col++) {
      const cell = gridData?.[row]?.[col];
      if (cell?.mc && cell.mc.rs == null) continue;

      const text = getCellDisplayText(cell);
      const fontSizePx = applyFontOnMeasurer(cell, cellSizeMeasurer);

      if (isCellWrapped(cell)) {
        const finalColumnWidth = Math.max(
          getColumnWidth(col, ctx, sheetFile),
          maxColumnWidths[col] || 0
        );
        cellSizeMeasurer!.style.whiteSpace = /[\r\n]/.test(text)
          ? "pre-wrap"
          : "normal";
        cellSizeMeasurer!.style.width = `${Math.max(
          5,
          finalColumnWidth - 8
        )}px`;
        cellSizeMeasurer!.textContent = text;
        const wrappedHeight = Math.ceil(cellSizeMeasurer!.scrollHeight + 6);
        if (wrappedHeight > requiredHeight) requiredHeight = wrappedHeight;
      } else {
        const singleLineHeight = Math.ceil(fontSizePx * 1.3 + 6);
        if (singleLineHeight > requiredHeight)
          requiredHeight = singleLineHeight;
      }
    }

    maxRowHeights[row] = requiredHeight;
  }
  return { rowMax: maxRowHeights, colMax: maxColumnWidths };
}

export function getColumnAutoFitWidth(ctx: Context, colIndex: number): number {
  const flowdata = getFlowdata(ctx);
  if (!flowdata) return ctx.defaultcollen;

  const rowCount = flowdata.length;

  let cellSizeMeasurer = document.getElementById(
    "fs-cell-measurer"
  ) as HTMLDivElement | null;
  if (!cellSizeMeasurer) {
    cellSizeMeasurer = document.createElement("div");
    cellSizeMeasurer.id = "fs-cell-measurer";
    Object.assign(cellSizeMeasurer.style, {
      position: "fixed",
      left: "-99999px",
      top: "-99999px",
      visibility: "hidden",
      lineHeight: "1.3",
      whiteSpace: "pre",
      wordBreak: "normal",
      overflowWrap: "break-word",
    });
    document.body.appendChild(cellSizeMeasurer);
  }

  let maxWidth = ctx.defaultcollen;

  for (let row = 0; row < rowCount; row++) {
    const cell = flowdata[row]?.[colIndex];
    if (!cell) continue;
    if (cell.mc && cell.mc.rs == null) continue;

    const text = getCellDisplayText(cell);
    if (!text) continue;

    applyFontOnMeasurer(cell, cellSizeMeasurer);
    // fs is stored in points; applyFontOnMeasurer incorrectly applies it as px,
    // so override with the correct pt unit to match canvas rendering
    const fontSizePt = (cell.fs as number | undefined) ?? ctx.defaultFontSize;
    cellSizeMeasurer.style.fontSize = `${fontSizePt}pt`;
    cellSizeMeasurer.style.whiteSpace = "pre";
    cellSizeMeasurer.style.width = "auto";
    cellSizeMeasurer.textContent = text;
    const intrinsicWidth = Math.ceil(cellSizeMeasurer.scrollWidth + 12);
    if (intrinsicWidth > maxWidth) maxWidth = intrinsicWidth;
  }

  return maxWidth;
}

export const updateSheetCellSizes = (
  ctx: Context,
  sheetIndex: number,
  measurements: {
    rowMax: Record<number, number>;
    colMax: Record<number, number>;
  },
  maxColumnWidth = 1200
) => {
  const sheetFile = ctx.luckysheetfile[sheetIndex];
  if (!sheetFile) return;

  // Ensure config objects exist
  if (!sheetFile.config) {
    sheetFile.config = {};
  }
  const { config } = sheetFile;

  if (!config.rowlen) {
    config.rowlen = {} as Record<number, number>;
  }
  const rowHeightsConfig = config.rowlen;

  if (!config.columnlen) {
    config.columnlen = {} as Record<number, number>;
  }
  const columnWidthsConfig = config.columnlen;

  const defaultRowHeight = sheetFile.defaultRowHeight ?? 19;

  Object.entries(measurements.rowMax).forEach(
    ([rowIndexString, requiredHeight]) => {
      const rowIndex = Number(rowIndexString);
      const currentHeight = rowHeightsConfig[rowIndex] ?? defaultRowHeight;

      if (requiredHeight > currentHeight) {
        rowHeightsConfig[rowIndex] = requiredHeight;
      }
    }
  );

  Object.entries(measurements.colMax).forEach(
    ([colIndexString, requiredWidth]) => {
      const colIndex = Number(colIndexString);
      const currentWidth = columnWidthsConfig[colIndex] ?? 0;
      const cappedWidth = Math.min(requiredWidth, maxColumnWidth);

      if (cappedWidth > currentWidth) {
        columnWidthsConfig[colIndex] = cappedWidth;
      }
    }
  );
  setRowHeight(ctx, rowHeightsConfig);
};
