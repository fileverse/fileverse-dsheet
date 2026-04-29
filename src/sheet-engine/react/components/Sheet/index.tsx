import React, { useRef, useEffect, useContext } from 'react';
import {
  Canvas,
  updateContextWithCanvas,
  updateContextWithSheetData,
  initFreeze,
  Sheet as SheetType,
  cellFadeAnimator,
} from '@sheet-engine/core';
import './index.css';
import WorkbookContext from '../../context';
import SheetOverlay from '../SheetOverlay';
import { useSmoothScroll } from './use-smooth-scroll';

type Props = {
  sheet: SheetType;
};

const Sheet: React.FC<Props> = ({ sheet }) => {
  const { data } = sheet;
  // const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const { context, setContext, refs, settings } = useContext(WorkbookContext);

  /**
   * Update data on window resize
   */
  useEffect(() => {
    function resize() {
      if (!data) return;
      setContext((draftCtx) => {
        if (settings.devicePixelRatio === 0) {
          draftCtx.devicePixelRatio = (globalThis || window).devicePixelRatio;
        }
        updateContextWithSheetData(draftCtx, data);
        updateContextWithCanvas(
          draftCtx,
          refs.canvas.current!,
          placeholderRef.current!,
        );
      });
    }
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [data, refs.canvas, setContext, settings.devicePixelRatio]);

  /**
   * Recalculate row/col info when data changes
   */
  useEffect(() => {
    if (!data) return;
    setContext((draftCtx) => updateContextWithSheetData(draftCtx, data));
  }, [
    context.config?.rowlen,
    context.config?.columnlen,
    context.config?.rowhidden,
    context.config.colhidden,
    data,
    context.zoomRatio,
    setContext,
  ]);

  /**
   * Init canvas
   */
  useEffect(() => {
    setContext((draftCtx) =>
      updateContextWithCanvas(
        draftCtx,
        refs.canvas.current!,
        placeholderRef.current!,
      ),
    );
  }, [
    refs.canvas,
    setContext,
    context.rowHeaderWidth,
    context.columnHeaderHeight,
    context.devicePixelRatio,
  ]);

  /**
   * Recalculate freeze data when sheet changes or sheet.frozen changes
   * should be defined before redraw
   */
  useEffect(() => {
    initFreeze(context, refs.globalCache, context.currentSheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    refs.globalCache,
    sheet.frozen,
    context.currentSheetId,
    context.visibledatacolumn,
    context.visibledatarow,
  ]);

  /**
   * Redraw canvas when context values that affect drawing change.
   * Depends only on context properties used by Canvas and repaint (scroll, layout, data, config).
   * Selection and other UI state (e.g. linkCard, contextMenu) are intentionally omitted so
   * selection changes do not trigger repaint.
   */
  useEffect(() => {
    // update formula chains value first if not empty
    if (context.groupValuesRefreshData.length > 0) {
      return;
    }

    const tableCanvas = new Canvas(refs.canvas.current!, context);
    const repaint = () => {
      const freeze = refs.globalCache.freezen?.[sheet.id!];

      if (
        freeze?.horizontal?.freezenhorizontaldata ||
        freeze?.vertical?.freezenverticaldata
      ) {
        const horizontalData = freeze?.horizontal?.freezenhorizontaldata;
        const verticallData = freeze?.vertical?.freezenverticaldata;

        if (horizontalData && verticallData) {
          const [horizontalPx, , horizontalScrollTop] = horizontalData;
          const [verticalPx, , verticalScrollWidth] = verticallData;

          // main
          tableCanvas.drawMain({
            scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
            scrollHeight:
              context.scrollTop + horizontalPx - horizontalScrollTop,
            offsetLeft:
              verticalPx - verticalScrollWidth + context.rowHeaderWidth,
            offsetTop:
              horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
            clear: true,
          });
          // right top
          tableCanvas.drawMain({
            scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
            scrollHeight: horizontalScrollTop,
            drawHeight: horizontalPx,
            offsetLeft:
              verticalPx - verticalScrollWidth + context.rowHeaderWidth,
          });
          // left down
          tableCanvas.drawMain({
            scrollWidth: verticalScrollWidth,
            scrollHeight:
              context.scrollTop + horizontalPx - horizontalScrollTop,
            drawWidth: verticalPx,
            offsetTop:
              horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
          });
          // left top
          tableCanvas.drawMain({
            scrollWidth: verticalScrollWidth,
            scrollHeight: horizontalScrollTop,
            drawWidth: verticalPx,
            drawHeight: horizontalPx,
          });
          // headers
          tableCanvas.drawColumnHeader(
            context.scrollLeft + verticalPx - verticalScrollWidth,
            undefined,
            verticalPx - verticalScrollWidth + context.rowHeaderWidth,
          );
          tableCanvas.drawColumnHeader(verticalScrollWidth, verticalPx);
          tableCanvas.drawRowHeader(
            context.scrollTop + horizontalPx - horizontalScrollTop,
            undefined,
            horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
          );
          tableCanvas.drawRowHeader(horizontalScrollTop, horizontalPx);
          tableCanvas.drawFreezeLine({
            horizontalTop:
              horizontalPx -
              horizontalScrollTop +
              context.columnHeaderHeight -
              2,
            verticalLeft:
              verticalPx - verticalScrollWidth + context.rowHeaderWidth - 2,
          });
        } else if (horizontalData) {
          const [horizontalPx, , horizontalScrollTop] = horizontalData;

          // main
          tableCanvas.drawMain({
            scrollWidth: context.scrollLeft,
            scrollHeight:
              context.scrollTop + horizontalPx - horizontalScrollTop,
            offsetTop:
              horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
            clear: true,
          });
          // top
          tableCanvas.drawMain({
            scrollWidth: context.scrollLeft,
            scrollHeight: horizontalScrollTop,
            drawHeight: horizontalPx,
          });
          // headers
          tableCanvas.drawColumnHeader(context.scrollLeft);
          tableCanvas.drawRowHeader(
            context.scrollTop + horizontalPx - horizontalScrollTop,
            undefined,
            horizontalPx - horizontalScrollTop + context.columnHeaderHeight,
          );
          tableCanvas.drawRowHeader(horizontalScrollTop, horizontalPx);
          tableCanvas.drawFreezeLine({
            horizontalTop:
              horizontalPx -
              horizontalScrollTop +
              context.columnHeaderHeight -
              2,
          });
        } else if (verticallData) {
          const [verticalPx, , verticalScrollWidth] = verticallData;

          // main
          tableCanvas.drawMain({
            scrollWidth: context.scrollLeft + verticalPx - verticalScrollWidth,
            scrollHeight: context.scrollTop,
            offsetLeft:
              verticalPx - verticalScrollWidth + context.rowHeaderWidth,
          });
          // left
          tableCanvas.drawMain({
            scrollWidth: verticalScrollWidth,
            scrollHeight: context.scrollTop,
            drawWidth: verticalPx,
          });
          // headers
          tableCanvas.drawRowHeader(context.scrollTop);
          tableCanvas.drawColumnHeader(
            context.scrollLeft + verticalPx - verticalScrollWidth,
            undefined,
            verticalPx - verticalScrollWidth + context.rowHeaderWidth,
          );
          tableCanvas.drawColumnHeader(verticalScrollWidth, verticalPx);
          tableCanvas.drawFreezeLine({
            verticalLeft:
              verticalPx - verticalScrollWidth + context.rowHeaderWidth - 2,
          });
        }
      } else {
        // without frozen
        tableCanvas.drawMain({
          scrollWidth: context.scrollLeft,
          scrollHeight: context.scrollTop,
          clear: true,
        });
        tableCanvas.drawColumnHeader(context.scrollLeft);
        tableCanvas.drawRowHeader(context.scrollTop);
      }
    };

    repaint();

    // keep repainting while fades are active
    cellFadeAnimator.setOnTick(repaint);

    return () => cellFadeAnimator.setOnTick(null);
    // Only context fields used by Canvas/repaint; selection and other UI state omitted to avoid repaint on selection change.
    // refs.globalCache.freezen is read inside repaint but mutated by initFreeze; repaint re-runs when layout/scroll/sheet change.
  }, [
    context.scrollLeft,
    context.scrollTop,
    context.rowHeaderWidth,
    context.columnHeaderHeight,
    context.visibledatarow,
    context.visibledatacolumn,
    context.config,
    context.currentSheetId,
    context.luckysheetfile,
    context.zoomRatio,
    context.devicePixelRatio,
    context.showGridLines,
    context.showFormulasFromFindReplace,
    context.luckysheetTableContentHW,
    context.defaultFontSize,
    context.defaultcollen,
    context.ch_width,
    context.luckysheetcurrentisPivotTable,
    context.hooks,
    refs.canvas,
    sheet.id,
  ]);

  useSmoothScroll(containerRef);

  return (
    <div ref={containerRef} className="fortune-sheet-container">
      {/* this is a placeholder div to help measure the empty space between toolbar and footer, directly measuring the canvas element is inaccurate, don't know why */}
      <div ref={placeholderRef} className="fortune-sheet-canvas-placeholder" />
      <canvas className="fortune-sheet-canvas" ref={refs.canvas} />
      <SheetOverlay />
    </div>
  );
};

export default Sheet;
