import { RefObject, useContext, useRef } from "react";
import {
  fixPositionOnFrozenCells,
  getSheetIndex,
  getFlowdata,
  colLocation,
  colLocationByIndex,
  updateContextWithSheetData,
  api,
} from "@sheet-engine/core";
import WorkbookContext from "../../../context";

export function numberToColumnName(num: number): string {
  let columnName = "";
  while (num >= 0) {
    const remainder = num % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    num = Math.floor(num / 26) - 1; // Move to the next significant position
  }
  return columnName;
}

export const useColumnDragAndDrop = (
  containerRef: RefObject<HTMLDivElement | null>,
  selectedLocationRef: RefObject<any[]>
) => {
  const DOUBLE_CLICK_MS = 300;
  const START_DRAG_THRESHOLD_PX = 6;
  const clickRef = useRef({ lastTime: 0, lastCol: -1 });
  const { context, setContext, refs } = useContext(WorkbookContext);
  const selectedColWidth = useRef(0);
  const selectedSourceColRef = useRef<number[]>([]);
  const selectedTargetColRef = useRef<number[]>([]);

  const dragRef = useRef({
    mouseDown: false,
    startX: 0,
    source: -1,
    active: false,
    lineEl: null as HTMLDivElement | null,
    ghostEl: null as HTMLDivElement | null,
    onDocMove: null as null | ((ev: MouseEvent) => void),
    onDocUp: null as null | ((ev: MouseEvent) => void),
    prevUserSelect: "" as string,
    prevWebkitUserSelect: "" as string,
    lastNativeEvent: null as MouseEvent | null,
    ghostWidthPx: 60,
  });

  const removeDragLine = () => {
    const { lineEl, ghostEl } = dragRef.current;
    try {
      if (lineEl?.parentElement) lineEl.parentElement.removeChild(lineEl);
    } catch {}
    try {
      if (ghostEl?.parentElement) ghostEl.parentElement.removeChild(ghostEl);
    } catch {}
    dragRef.current.lineEl = null;
    dragRef.current.ghostEl = null;
    dragRef.current.active = false;
  };

  const getColIndexClicked = (pageX: number, headerEl: HTMLDivElement) => {
    const rect = headerEl.getBoundingClientRect();
    const mouseXInHeader = pageX - rect.left - window.scrollX;
    const localXInHeader = mouseXInHeader + headerEl.scrollLeft;
    const freeze = refs.globalCache.freezen?.[context.currentSheetId];
    const { x: adjustedX } = fixPositionOnFrozenCells(
      freeze,
      localXInHeader,
      0,
      mouseXInHeader,
      0
    );
    const [, , colIndex] = colLocation(adjustedX, context.visibledatacolumn);
    return colIndex;
  };

  const isColDoubleClicked = (clickedColIndex: number) => {
    const now = performance.now();
    const isDoubleClicked =
      now - clickRef.current.lastTime < DOUBLE_CLICK_MS &&
      clickRef.current.lastCol === clickedColIndex;
    clickRef.current.lastTime = now;
    clickRef.current.lastCol = clickedColIndex;
    return isDoubleClicked;
  };

  const computeInsertionFromPageX = (pageX: number) => {
    const workbookEl = containerRef.current;
    if (!workbookEl)
      return { insertionIndex: -1, lineLeftPx: 0, mouseXInWorkbook: 0 };

    const wbRect = workbookEl.getBoundingClientRect();
    const mouseXInWorkbook = pageX - wbRect.left - window.scrollX;
    const localXInWorkbook =
      mouseXInWorkbook +
      (containerRef?.current?.scrollLeft ?? context.scrollLeft);

    const freeze = refs.globalCache.freezen?.[context.currentSheetId];
    const { x: xWorkbook } = fixPositionOnFrozenCells(
      freeze,
      localXInWorkbook,
      0,
      mouseXInWorkbook,
      0
    );

    const [colLeftPx, colRightPx, hoveredColIndex] = colLocation(
      xWorkbook,
      context.visibledatacolumn
    );

    const colMidPx = (colLeftPx + colRightPx) / 2;
    let insertionIndex = hoveredColIndex + (xWorkbook > colMidPx ? 1 : 0);

    const sheetIdx = getSheetIndex(context, context.currentSheetId);
    const sheetLocal =
      sheetIdx == null ? null : context.luckysheetfile[sheetIdx];
    const maxCols =
      sheetLocal?.data?.[0]?.length ?? context.visibledatacolumn.length;
    insertionIndex = Math.max(0, Math.min(maxCols, insertionIndex));

    const lineLeftPx = xWorkbook > colMidPx ? colRightPx : colLeftPx;
    return { insertionIndex, lineLeftPx, mouseXInWorkbook };
  };

  const createInsertionLine = (host: HTMLElement) => {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.top = "0px";
    el.style.bottom = "0px";
    el.style.width = "2px";
    el.style.background = "#EFC703";
    el.style.zIndex = "9999";
    el.style.pointerEvents = "none";
    host.appendChild(el);
    return el;
  };

  const createGhost = (host: HTMLElement) => {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.top = "134px";
    el.style.height = `${window.innerHeight}px`;
    el.style.boxSizing = "border-box";
    el.style.padding = "6px 8px";
    el.style.background = "rgba(239,199,3,0.10)";
    el.style.border = "1px solid #EFC703";
    el.style.borderRadius = "6px";
    el.style.zIndex = "10000";
    el.style.pointerEvents = "none";
    el.style.display = "flex";
    el.style.alignItems = "start";
    el.style.justifyContent = "center";
    el.style.fontSize = "12px";
    el.style.fontWeight = "500";

    let ghostWidthPx = 60;
    let ghostLabel = `Col ${String.fromCharCode(65 + dragRef.current.source)}`;

    const selectedBlock = selectedLocationRef.current?.find(
      (s) => s.c1 <= dragRef.current.source && dragRef.current.source <= s.c2
    );

    if (selectedBlock) {
      ghostWidthPx = Math.max(
        60,
        selectedBlock.col - selectedBlock.col_pre - 1
      );
      selectedColWidth.current = ghostWidthPx;
      const count = selectedBlock.c2 - selectedBlock.c1 + 1;
      ghostLabel =
        count > 1
          ? `${count} cols`
          : `Col ${String.fromCharCode(65 + selectedBlock.c1)}`;
    } else {
      const [pre, end] = colLocationByIndex(
        dragRef.current.source,
        context.visibledatacolumn
      );
      const sourceColWidth = end - pre - 1;
      ghostWidthPx = Math.max(60, sourceColWidth);
      selectedColWidth.current = ghostWidthPx;
    }

    el.style.width = `${ghostWidthPx}px`;
    el.textContent = ghostLabel;
    host.appendChild(el);
    return { el, ghostWidthPx };
  };

  const isDragActivated = (host: HTMLElement, pixelDeltaX: number) => {
    if (dragRef.current.active) return true;
    if (pixelDeltaX < START_DRAG_THRESHOLD_PX) return false;

    dragRef.current.active = true;

    // disable text selection
    dragRef.current.prevUserSelect = document.body.style.userSelect;
    dragRef.current.prevWebkitUserSelect = (
      document.body.style as any
    ).webkitUserSelect;
    document.body.style.userSelect = "none";
    (document.body.style as any).webkitUserSelect = "none";

    // visuals
    dragRef.current.lineEl = createInsertionLine(host);
    const { el, ghostWidthPx } = createGhost(host);
    dragRef.current.ghostEl = el;
    dragRef.current.ghostWidthPx = ghostWidthPx;

    return true;
  };

  const handleColumnDrag = (ev: MouseEvent) => {
    if (!dragRef.current.mouseDown) return;
    dragRef.current.lastNativeEvent = ev;

    const host = containerRef.current;
    if (!host) return;

    const dragOffset = Math.abs(ev.pageX - dragRef.current.startX);
    if (!isDragActivated(host, dragOffset)) return;

    const { lineLeftPx } = computeInsertionFromPageX(ev.pageX);
    const ghostPosOffset = 60;
    const ghostFinalPos =
      dragRef.current.startX > ev.pageX
        ? lineLeftPx + ghostPosOffset
        : lineLeftPx - (selectedColWidth.current - ghostPosOffset);

    if (dragRef.current.lineEl) {
      dragRef.current.lineEl.style.left = `${lineLeftPx}px`;
    }

    if (dragRef.current.ghostEl) {
      dragRef.current.ghostEl.style.left = `${ghostFinalPos}px`;
    }
  };

  const handleColumnDragEnd = (ev: MouseEvent) => {
    if (!dragRef.current.mouseDown) return;
    dragRef.current.mouseDown = false;

    // restore selection
    try {
      document.body.style.userSelect = dragRef.current.prevUserSelect || "";
      (document.body.style as any).webkitUserSelect =
        dragRef.current.prevWebkitUserSelect || "";
    } catch {}

    if (dragRef.current.active) {
      const { insertionIndex: finalInsertionIndex } = computeInsertionFromPageX(
        ev.pageX
      );

      const sourceIndex = context.luckysheet_select_save?.[0]?.column?.[0] || 0;
      const sheetIdx = getSheetIndex(context, context.currentSheetId);

      if (
        sheetIdx != null &&
        sourceIndex >= 0 &&
        Number.isFinite(finalInsertionIndex) &&
        finalInsertionIndex >= 0
      ) {
        setContext((draft) => {
          const _sheet = draft.luckysheetfile[sheetIdx];
          if (!_sheet?.data) return;
          const rows = _sheet.data;
          if (rows.length === 0) return;

          const numCols = rows[0]?.length ?? 0;
          if (sourceIndex < 0 || sourceIndex >= numCols) return;

          // remove-then-insert adjustment
          let targetIndex = finalInsertionIndex;
          if (targetIndex > sourceIndex) targetIndex -= 1;

          const selectedColRange =
            context.luckysheet_select_save?.[0]?.column || [];
          const selectedSourceCol: number[] = [];
          for (
            let i = selectedColRange?.[0];
            i <= selectedColRange?.[1];
            i += 1
          ) {
            selectedSourceCol.push(i);
          }

          const tempSelectedTargetCol: number[] = [];
          selectedSourceCol.forEach((_, index) => {
            if (sourceIndex < targetIndex) {
              tempSelectedTargetCol.push(targetIndex - index);
            } else {
              tempSelectedTargetCol.push(targetIndex + index);
            }
          });
          const selectedTargetCol = [...tempSelectedTargetCol]?.sort(
            (a, b) => a - b
          );

          selectedSourceColRef.current = selectedSourceCol;
          selectedTargetColRef.current = selectedTargetCol;

          // Move column data in each row
          selectedSourceCol.forEach(() => {
            let adjustedSourceIndex = sourceIndex;
            if (targetIndex < sourceIndex) {
              adjustedSourceIndex =
                sourceIndex + (selectedSourceCol.length - 1);
            }
            for (let j = 0; j < rows.length; j += 1) {
              const row = rows[j];
              if (!row || adjustedSourceIndex >= row.length) continue;

              const [cellData] = row.splice(adjustedSourceIndex, 1);
              if (targetIndex < 0) targetIndex = 0;
              if (targetIndex > row.length) targetIndex = row.length;
              row.splice(targetIndex, 0, cellData);
            }
          });

          _sheet.data = rows;
          updateContextWithSheetData(draft, _sheet.data);

          // update formula
          const d = getFlowdata(draft);
          d?.forEach((row) => {
            row.forEach((cell) => {
              if (cell) {
                const otherAffectedCols: any[] = [];
                if (sourceIndex < targetIndex) {
                  const start =
                    selectedSourceCol?.[selectedSourceCol.length - 1];
                  const last =
                    selectedTargetCol?.[selectedTargetCol.length - 1];
                  for (let c = start + 1; c <= last; c += 1) {
                    otherAffectedCols.push({
                      source: numberToColumnName(c),
                      target: numberToColumnName(c - selectedSourceCol.length),
                    });
                  }
                  // to visit back on this logix if need + methond or array is fine.
                  selectedSourceCol.forEach((c: number, index: number) => {
                    otherAffectedCols.push({
                      source: numberToColumnName(c),
                      target: numberToColumnName(selectedTargetCol[index]),
                    });
                  });
                } else if (sourceIndex > targetIndex) {
                  const start = selectedTargetCol?.[0];
                  const last = selectedSourceCol?.[0];
                  for (let c = start; c < last; c += 1) {
                    otherAffectedCols.push({
                      source: numberToColumnName(c),
                      target: numberToColumnName(c + selectedSourceCol.length),
                    });
                  }
                  selectedSourceCol.forEach((c: number, index: number) => {
                    otherAffectedCols.push({
                      source: numberToColumnName(c),
                      target: numberToColumnName(selectedTargetCol[index]),
                    });
                  });
                }

                if (cell.f) {
                  let formula = cell.f;
                  const replacements: any[] = [];

                  // Collect all replacement positions first
                  otherAffectedCols.forEach((col) => {
                    const regex = new RegExp(`\\b${col.source}(\\d+)\\b`, "g");
                    let match;

                    // eslint-disable-next-line no-cond-assign
                    while ((match = regex.exec(formula)) !== null) {
                      if (/^\d+$/.test(match[1])) {
                        replacements.push({
                          start: match.index,
                          end: match.index + match[0].length,
                          original: match[0],
                          replacement: `${col.target}${match[1]}`,
                        });
                      }
                    }
                  });

                  // Sort by position (descending) and apply replacements from end to start
                  replacements?.sort((a, b) => b.start - a.start);

                  replacements?.forEach((rep) => {
                    formula =
                      formula.substring(0, rep.start) +
                      rep.replacement +
                      formula.substring(rep.end);
                  });

                  cell.f = formula;
                }
              }
            });
          });

          // update dataVerification
          if (_sheet.dataVerification) {
            const newDataVerification: any = {};
            Object.keys(_sheet.dataVerification).forEach((item) => {
              const itemData = _sheet.dataVerification?.[item];
              const colRow = item.split("_");
              if (colRow.length !== 2) return;
              const presentcol = parseInt(colRow[1], 10);
              let updatedCol = presentcol;
              if (selectedSourceCol.includes(presentcol)) {
                const index = selectedSourceCol.indexOf(presentcol);
                const target = selectedTargetCol[index];
                updatedCol = target;
              } else if (presentcol > sourceIndex && presentcol < targetIndex) {
                updatedCol -= selectedSourceCol.length;
              } else if (
                presentcol < sourceIndex &&
                presentcol >= targetIndex
              ) {
                updatedCol += selectedSourceCol.length;
              }
              newDataVerification[`${colRow[0]}_${updatedCol}`] = itemData;
            });
            _sheet.dataVerification = newDataVerification;
          }

          if (_sheet.hyperlink) {
            const newHyperlink: Record<
              string,
              { linkType: string; linkAddress: string }
            > = {};
            Object.keys(_sheet.hyperlink).forEach((key) => {
              const itemData = _sheet.hyperlink?.[key];
              if (!itemData) return;
              const parts = key.split("_");
              if (parts.length !== 2) return;
              const row = parts[0];
              const presentCol = parseInt(parts[1], 10);
              let updatedCol = presentCol;
              if (selectedSourceCol.includes(presentCol)) {
                const index = selectedSourceCol.indexOf(presentCol);
                updatedCol = selectedTargetCol[index];
              } else if (presentCol > sourceIndex && presentCol < targetIndex) {
                updatedCol -= selectedSourceCol.length;
              } else if (
                presentCol < sourceIndex &&
                presentCol >= targetIndex
              ) {
                updatedCol += selectedSourceCol.length;
              }
              newHyperlink[`${row}_${updatedCol}`] = itemData;
            });
            _sheet.hyperlink = newHyperlink;
          }

          // update calc chain
          _sheet.calcChain?.forEach((item) => {
            if (selectedSourceCol.includes(item.c)) {
              const index = selectedSourceCol.indexOf(item.c);
              item.c = selectedTargetCol[index];
            } else if (item.c > sourceIndex && item.c < targetIndex) {
              item.c -= selectedSourceCol.length;
            } else if (item.c < sourceIndex && item.c >= targetIndex) {
              item.c += selectedSourceCol.length;
            }
          });

          // update data block
          // @ts-expect-error
          window?.updateDataBlockCalcFunctionAfterRowDrag?.(
            selectedSourceCol,
            selectedTargetCol,
            "column",
            context.currentSheetId,
            sourceIndex,
            targetIndex
          );
          // Notify Yjs for every cell in the disturbed range (moved column + all columns in between)
          const cellChanges: {
            sheetId: string;
            path: string[];
            key?: string;
            value: any;
            type?: "update" | "delete";
          }[] = [];
          const affectedColStart = Math.min(sourceIndex, targetIndex);
          const affectedColEnd =
            Math.max(sourceIndex, targetIndex) + selectedSourceCol.length - 1;
          const numRows = rows.length;
          for (let r = 0; r < numRows; r += 1) {
            const row = rows[r];
            for (let c = affectedColStart; c <= affectedColEnd; c += 1) {
              const cell = row?.[c];
              cellChanges.push({
                sheetId: draft.currentSheetId,
                path: ["celldata"],
                value: { r, c, v: cell ?? null },
                key: `${r}_${c}`,
                type: "update",
              });
            }
          }
          if (cellChanges.length > 0 && draft.hooks?.updateCellYdoc) {
            draft.hooks.updateCellYdoc(cellChanges);
          }
          const rowLen = d?.length || 0;
          api.setSelection(
            draft,
            [
              {
                row: [0, rowLen],
                column: [
                  selectedTargetCol?.[0],
                  selectedTargetCol?.[selectedTargetCol.length - 1],
                ],
              },
            ],
            {
              id: context.currentSheetId,
            }
          );
        });
      }
    }

    // cleanup
    removeDragLine();
    dragRef.current.active = false;
    dragRef.current.source = -1;

    if (dragRef.current.onDocMove)
      document.removeEventListener("mousemove", dragRef.current.onDocMove);
    if (dragRef.current.onDocUp)
      document.removeEventListener("mouseup", dragRef.current.onDocUp);
    dragRef.current.onDocMove = null;
    dragRef.current.onDocUp = null;
  };

  const initiateDrag = (clickedColIndex: number, startX: number) => {
    dragRef.current.mouseDown = true;
    dragRef.current.startX = startX;
    dragRef.current.source = clickedColIndex;
    dragRef.current.active = false;

    dragRef.current.onDocMove = handleColumnDrag;
    dragRef.current.onDocUp = handleColumnDragEnd;
    document.addEventListener("mousemove", handleColumnDrag);
    document.addEventListener("mouseup", handleColumnDragEnd);
  };

  return {
    initiateDrag,
    getColIndexClicked,
    isColDoubleClicked,
    mouseDown: dragRef.current.mouseDown,
  };
};
