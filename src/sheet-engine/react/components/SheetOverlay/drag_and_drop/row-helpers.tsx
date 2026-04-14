import { RefObject, useContext, useRef } from 'react';
import {
  fixPositionOnFrozenCells,
  getSheetIndex,
  rowLocation,
  getFlowdata,
  rowLocationByIndex,
  updateContextWithSheetData,
  api,
  remapFormulaReferencesByMap,
  type HyperlinkEntry,
} from '@sheet-engine/core';
import WorkbookContext from '../../../context';

export const useRowDragAndDrop = (
  containerRef: RefObject<HTMLDivElement | null>,
  selectedLocationRef: RefObject<any[]>,
) => {
  const DOUBLE_MS = 300;
  const START_DRAG_THRESHOLD_PX = 6;
  const clickRef = useRef({ lastTime: 0, lastRow: -1 });
  const { context, setContext, refs } = useContext(WorkbookContext);
  const selectedRowHeight = useRef(0);
  const selectedSourceRowRef = useRef<number[]>([]);
  const selectedTargetRowRef = useRef<number[]>([]);

  const dragRef = useRef({
    mouseDown: false,
    startY: 0,
    source: -1,
    active: false,
    lineEl: null as HTMLDivElement | null,
    ghostEl: null as HTMLDivElement | null,
    onDocMove: null as null | ((ev: MouseEvent) => void),
    onDocUp: null as null | ((ev: MouseEvent) => void),
    prevUserSelect: '' as string,
    prevWebkitUserSelect: '' as string,
    lastNativeEvent: null as MouseEvent | null,
    ghostHeightPx: 24,
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
  const getRowIndexClicked = (pageY: number, headerEl: HTMLDivElement) => {
    const rect = headerEl.getBoundingClientRect();
    const mouseYInHeader = pageY - rect.top - window.scrollY;
    const localYInHeader = mouseYInHeader + headerEl.scrollTop;
    const freeze = refs.globalCache.freezen?.[context.currentSheetId];
    const { y: adjustedY } = fixPositionOnFrozenCells(
      freeze,
      0,
      localYInHeader,
      0,
      mouseYInHeader,
    );
    const [, , rowIndex] = rowLocation(adjustedY, context.visibledatarow);
    return rowIndex;
  };

  const isRowDoubleClicked = (clickedRowIndex: number) => {
    const now = performance.now();
    const isDoubleClicked =
      now - clickRef.current.lastTime < DOUBLE_MS &&
      clickRef.current.lastRow === clickedRowIndex;
    clickRef.current.lastTime = now;
    clickRef.current.lastRow = clickedRowIndex;
    return isDoubleClicked;
  };

  const computeInsertionFromPageY = (pageY: number) => {
    const workbookEl = containerRef.current;
    if (!workbookEl)
      return { insertionIndex: -1, lineTopPx: 0, mouseYInWorkbook: 0 };

    const wbRect = workbookEl.getBoundingClientRect();
    const mouseYInWorkbook = pageY - wbRect.top - window.scrollY;
    const localYInWorkbook =
      mouseYInWorkbook +
      (containerRef?.current?.scrollTop ?? context.scrollTop);

    const freeze = refs.globalCache.freezen?.[context.currentSheetId];
    const { y: yWorkbook } = fixPositionOnFrozenCells(
      freeze,
      0,
      localYInWorkbook,
      0,
      mouseYInWorkbook,
    );

    const [rowTopPx, rowBottomPx, hoveredRowIndex] = rowLocation(
      yWorkbook,
      context.visibledatarow,
    );

    const rowMidPx = (rowTopPx + rowBottomPx) / 2;
    let insertionIndex = hoveredRowIndex + (yWorkbook > rowMidPx ? 1 : 0);

    const sheetIdx = getSheetIndex(context, context.currentSheetId);
    const sheetLocal =
      sheetIdx == null ? null : context.luckysheetfile[sheetIdx];
    const maxRows = sheetLocal?.data?.length ?? context.visibledatarow.length;
    insertionIndex = Math.max(0, Math.min(maxRows, insertionIndex));

    const lineTopPx = yWorkbook > rowMidPx ? rowBottomPx : rowTopPx;
    return { insertionIndex, lineTopPx, mouseYInWorkbook };
  };
  const createInsertionLine = (host: HTMLElement) => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.right = '0px';
    el.style.height = '2px';
    el.style.background = '#EFC703';
    el.style.zIndex = '9999';
    el.style.pointerEvents = 'none';
    host.appendChild(el);
    return el;
  };
  const createGhost = (host: HTMLElement) => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.left = '58px';
    el.style.width = `${window.innerWidth}px`;
    el.style.boxSizing = 'border-box';
    el.style.padding = '6px 8px';
    el.style.background = 'rgba(239,199,3,0.10)';
    el.style.border = '1px solid #EFC703';
    el.style.borderRadius = '6px';
    el.style.zIndex = '10000';
    el.style.pointerEvents = 'none';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.fontSize = '12px';
    el.style.fontWeight = '500';

    let ghostHeightPx = 24;
    let ghostLabel = `${dragRef.current.source + 1} row`;

    const selectedBlock = selectedLocationRef?.current?.find(
      (s) => s.r1 <= dragRef.current.source && dragRef.current.source <= s.r2,
    );

    if (selectedBlock) {
      ghostHeightPx = Math.max(
        24,
        selectedBlock.row - selectedBlock.row_pre - 1,
      );
      selectedRowHeight.current = ghostHeightPx;
      const count = selectedBlock.r2 - selectedBlock.r1 + 1;
      ghostLabel = count > 1 ? `${count} rows` : `${selectedBlock.r1 + 1} row`;
    } else {
      const [pre, end] = rowLocationByIndex(
        dragRef.current.source,
        context.visibledatarow,
      );
      const sourceRowHeight = end - pre - 1;
      ghostHeightPx = Math.max(24, sourceRowHeight);
      selectedRowHeight.current = ghostHeightPx;
    }

    el.style.height = `${ghostHeightPx}px`;
    el.textContent = ghostLabel;
    host.appendChild(el);
    return { el, ghostHeightPx };
  };
  const isDragActivated = (host: HTMLElement, pixelDeltaY: number) => {
    if (dragRef.current.active) return true;
    if (pixelDeltaY < START_DRAG_THRESHOLD_PX) return false;

    dragRef.current.active = true;

    // disable text selection
    dragRef.current.prevUserSelect = document.body.style.userSelect;
    dragRef.current.prevWebkitUserSelect = (
      document.body.style as any
    ).webkitUserSelect;
    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';

    // visuals
    dragRef.current.lineEl = createInsertionLine(host);
    const { el, ghostHeightPx } = createGhost(host);
    dragRef.current.ghostEl = el;
    dragRef.current.ghostHeightPx = ghostHeightPx;

    return true;
  };

  const handleRowDrag = (ev: MouseEvent) => {
    if (!dragRef.current.mouseDown) return;
    dragRef.current.lastNativeEvent = ev;

    const host = containerRef.current;
    if (!host) return;

    const dragOffset = Math.abs(ev.pageY - dragRef.current.startY);
    if (!isDragActivated(host, dragOffset)) return;

    const { lineTopPx } = computeInsertionFromPageY(ev.pageY);
    // const ghostPosOffset = dragRef.current.startY > ev.pageY ? 25 : 25;
    const rows = context.luckysheet_select_save?.[0]?.row;
    const selectedRowLength =
      rows && rows[1] != null && rows[0] != null ? rows[1] - rows[0] + 1 : 0;
    const off = 3 - selectedRowLength;
    const bottomOff = (off + 1) * 25;
    const topRowOff = selectedRowLength - 4;
    const topOff = topRowOff * 25;
    const ghostFinalPos =
      dragRef.current.startY > ev.pageY
        ? lineTopPx - topOff
        : lineTopPx + bottomOff;

    if (dragRef.current.lineEl) {
      dragRef.current.lineEl.style.top = `${lineTopPx}px`;
    }

    if (dragRef.current.ghostEl) {
      dragRef.current.ghostEl.style.top = `${ghostFinalPos}px`;
    }
  };

  const handleRowDragEnd = (ev: MouseEvent) => {
    if (!dragRef.current.mouseDown) return;
    dragRef.current.mouseDown = false;

    // restore selection
    try {
      document.body.style.userSelect = dragRef.current.prevUserSelect || '';
      (document.body.style as any).webkitUserSelect =
        dragRef.current.prevWebkitUserSelect || '';
    } catch {}

    if (dragRef.current.active) {
      const { insertionIndex: finalInsertionIndex } = computeInsertionFromPageY(
        ev.pageY,
      );

      const sourceIndex = context.luckysheet_select_save?.[0]?.row?.[0] || 0;
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
          if (sourceIndex < 0 || sourceIndex >= rows.length) return;

          // remove-then-insert adjustment
          let targetIndex = finalInsertionIndex;
          if (targetIndex > sourceIndex) targetIndex -= 1;

          const selectedRowRange =
            context.luckysheet_select_save?.[0]?.row || [];
          const selectedSourceRow: number[] = [];
          for (
            let i = selectedRowRange?.[0];
            i <= selectedRowRange?.[1];
            i += 1
          ) {
            selectedSourceRow.push(i);
          }

          const tempSelectedTargetRow: number[] = [];
          selectedSourceRow.forEach((_, index) => {
            if (sourceIndex < targetIndex) {
              tempSelectedTargetRow.push(targetIndex - index);
            } else {
              tempSelectedTargetRow.push(targetIndex + index);
            }
          });
          const selectedTargetRow = [...tempSelectedTargetRow]?.sort(
            (a, b) => a - b,
          );

          selectedSourceRowRef.current = selectedSourceRow;
          selectedTargetRowRef.current = selectedTargetRow;

          selectedSourceRow.forEach(() => {
            let adjustedSourceIndex = sourceIndex;
            if (targetIndex < sourceIndex) {
              adjustedSourceIndex =
                sourceIndex + (selectedSourceRow.length - 1);
            }
            const [rowData] = rows.splice(adjustedSourceIndex, 1);
            if (targetIndex < 0) targetIndex = 0;
            if (targetIndex > rows.length) targetIndex = rows.length;
            rows.splice(targetIndex, 0, rowData);
          });

          _sheet.data = rows;
          updateContextWithSheetData(draft, _sheet.data);

          const d = getFlowdata(draft);
          const rowMap: Record<number, number> = (() => {
            const order = Array.from({ length: rows.length }, (_, i) => i);
            const sourceStart = selectedSourceRow[0] ?? sourceIndex;
            const count = selectedSourceRow.length;
            if (count <= 0) return {};
            const moved = order.splice(sourceStart, count);
            let insertAt = targetIndex;
            if (insertAt < 0) insertAt = 0;
            if (insertAt > order.length) insertAt = order.length;
            order.splice(insertAt, 0, ...moved);
            const map: Record<number, number> = {};
            order.forEach((oldIdx, newIdx) => {
              map[oldIdx] = newIdx;
            });
            return map;
          })();

          d?.forEach((row) => {
            row.forEach((cell) => {
              if (cell) {
                if (cell.f) {
                  const sheetName = _sheet.name || '';
                  cell.f = remapFormulaReferencesByMap(
                    cell.f,
                    sheetName,
                    sheetName,
                    { rowMap },
                  );
                }
              }
            });
          });

          if (_sheet.dataVerification) {
            const newDataVerification: any = {};
            Object.keys(_sheet.dataVerification).forEach((item) => {
              const itemData = _sheet.dataVerification?.[item];
              const colRow = item.split('_');
              if (colRow.length !== 2) return;
              const presentRow = parseInt(colRow[0], 10);
              const updatedRow =
                rowMap[presentRow] != null ? rowMap[presentRow] : presentRow;
              newDataVerification[`${updatedRow}_${colRow[1]}`] = itemData;
            });
            _sheet.dataVerification = newDataVerification;
          }

          if (_sheet.hyperlink) {
            const newHyperlink: Record<
              string,
              HyperlinkEntry | HyperlinkEntry[]
            > = {};
            Object.keys(_sheet.hyperlink).forEach((key) => {
              const itemData = _sheet.hyperlink?.[key];
              if (!itemData) return;
              const parts = key.split('_');
              if (parts.length !== 2) return;
              const presentRow = parseInt(parts[0], 10);
              const col = parts[1];
              const updatedRow =
                rowMap[presentRow] != null ? rowMap[presentRow] : presentRow;
              newHyperlink[`${updatedRow}_${col}`] = itemData;
            });
            _sheet.hyperlink = newHyperlink;
          }

          _sheet.calcChain?.forEach((item) => {
            item.r = rowMap[item.r] != null ? rowMap[item.r] : item.r;
          });
          // @ts-expect-error
          window?.updateDataBlockCalcFunctionAfterRowDrag?.(
            sourceIndex,
            targetIndex,
            'row',
            context.currentSheetId,
          );
          // Notify Yjs for every cell in the disturbed range (moved row + all rows in between)
          const cellChanges: {
            sheetId: string;
            path: string[];
            key?: string;
            value: any;
            type?: 'update' | 'delete';
          }[] = [];
          const affectedRowStart = Math.min(sourceIndex, targetIndex);
          const affectedRowEnd =
            Math.max(sourceIndex, targetIndex) + selectedSourceRow.length - 1;
          const numCols = d?.[0]?.length ?? 0;
          for (let r = affectedRowStart; r <= affectedRowEnd; r += 1) {
            const row = rows[r];
            for (let c = 0; c < numCols; c += 1) {
              const cell = row?.[c];
              cellChanges.push({
                sheetId: draft.currentSheetId,
                path: ['celldata'],
                value: { r, c, v: cell ?? null },
                key: `${r}_${c}`,
                type: 'update',
              });
            }
          }
          if (cellChanges.length > 0 && draft.hooks?.updateCellYdoc) {
            draft.hooks.updateCellYdoc(cellChanges);
          }
          const colLen = d?.[0]?.length || 0;
          api.setSelection(
            draft,
            [
              {
                row: [
                  selectedTargetRow[0],
                  selectedTargetRow[selectedTargetRow.length - 1],
                ],
                column: [0, colLen],
              },
            ],
            {
              id: context.currentSheetId,
            },
          );
        });
      }
    }

    // cleanup
    removeDragLine();
    dragRef.current.active = false;
    dragRef.current.source = -1;

    if (dragRef.current.onDocMove)
      document.removeEventListener('mousemove', dragRef.current.onDocMove);
    if (dragRef.current.onDocUp)
      document.removeEventListener('mouseup', dragRef.current.onDocUp);
    dragRef.current.onDocMove = null;
    dragRef.current.onDocUp = null;
  };

  const initiateDrag = (clickedRowIndex: number, startY: number) => {
    dragRef.current.mouseDown = true;
    dragRef.current.startY = startY;
    dragRef.current.source = clickedRowIndex;
    dragRef.current.active = false;

    dragRef.current.onDocMove = handleRowDrag;
    dragRef.current.onDocUp = handleRowDragEnd;
    document.addEventListener('mousemove', handleRowDrag);
    document.addEventListener('mouseup', handleRowDragEnd);
  };

  return {
    initiateDrag,
    getRowIndexClicked,
    isRowDoubleClicked,
    mouseDown: dragRef.current.mouseDown,
  };
};
