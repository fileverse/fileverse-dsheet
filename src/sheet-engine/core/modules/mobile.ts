import { Context } from '..';
import { GlobalCache } from '../types';

// export default function mobileinit(ctx: Context) {
//   ctx.cellMainSrollBarSize = 0;
//   // let luckysheet_touchmove_status = false;
//   // let luckysheet_touchmove_startPos = {};
//   // const luckysheet_touchhandle_status = false;
// }

export function handleOverlayTouchStart(
  ctx: Context,
  e: TouchEvent,
  globalCache: GlobalCache,
) {
  globalCache.touchMoveStatus = true;
  const touch = e.targetTouches[0];
  globalCache.touchMoveStartPos = {
    x: touch.pageX,
    y: touch.pageY,
    vy: 0,
    moveType: 'y',
  };
}

export function handleOverlayTouchMove(
  ctx: Context,
  e: TouchEvent,
  globalCache: GlobalCache,
  scrollbarX: HTMLDivElement,
  scrollbarY: HTMLDivElement,
) {
  if (e.targetTouches.length > 1) return;
  const touch = e.targetTouches[0];
  if (!globalCache.touchMoveStatus || !globalCache.touchMoveStartPos) return;
  const TOUCH_SCROLL_FACTOR = 0.1;

  const start = globalCache.touchMoveStartPos;

  const slideX = (touch.pageX - start.x) * TOUCH_SCROLL_FACTOR;
  const slideY = (touch.pageY - start.y) * TOUCH_SCROLL_FACTOR;

  let { scrollLeft } = ctx;
  let { scrollTop } = ctx;

  scrollLeft -= slideX;
  scrollTop -= slideY;

  scrollbarY.scrollTop = scrollTop;
  scrollbarX.scrollLeft = scrollLeft;

  start.vy_x = slideX;
  start.vy_y = slideY;
  start.scrollLeft = scrollLeft;
  start.scrollTop = scrollTop;
}

export function handleOverlayTouchEnd(globalCache: GlobalCache) {
  globalCache.touchMoveStatus = false;
  globalCache.touchHandleStatus = false;
}
