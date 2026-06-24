import {
  isZoomInShortcut,
  isZoomOutShortcut,
} from '../events/keyboard-shortcut-utils';

// 缩放步长
// const ZOOM_WHEEL_STEP = 0.02; // ctrl + 鼠标滚轮
const ZOOM_STEP = 0.1; // 点击以及 Ctrl/Cmd + +-

// 缩放最大最小比例
export const MAX_ZOOM_RATIO = 4;
export const MIN_ZOOM_RATIO = 0.1;

function clampZoom(zoom: number): number {
  if (zoom >= MAX_ZOOM_RATIO) return MAX_ZOOM_RATIO;
  if (zoom < MIN_ZOOM_RATIO) return MIN_ZOOM_RATIO;
  return parseFloat(zoom.toFixed(1));
}

export function handleKeydownForZoom(ev: KeyboardEvent, currentZoom: number) {
  let zoom = currentZoom || 1;
  let handled = false;

  if (isZoomInShortcut(ev)) {
    zoom += ZOOM_STEP;
    handled = true;
  } else if (isZoomOutShortcut(ev)) {
    zoom -= ZOOM_STEP;
    handled = true;
  }

  if (handled) {
    ev.preventDefault();
    return clampZoom(zoom);
  }
  return currentZoom;
}

export function applyZoomStep(
  currentZoom: number,
  direction: 'in' | 'out' | 'reset',
): number {
  if (direction === 'reset') return 1;
  const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP;
  return clampZoom((currentZoom || 1) + delta);
}
