import _ from 'lodash';
import { GlobalCache, Image } from '../types';
import { mergeBorder } from '.';
import { Context, getFlowdata } from '../context';
import { getSheetIndex } from '../utils';
import {
  clearImageClipboard,
  clearImageCutFlag,
  getImageClipboard,
  getImageCutSourceId,
  setImageClipboard,
} from './image-clipboard';

export {
  clearImageClipboard,
  getImageClipboard,
  getImageCutSourceId,
} from './image-clipboard';

type ImageProps = {
  defaultWidth: number;
  defaultHeight: number;
  currentObj: null;
  currentWinW: null;
  currentWinH: null;
  resize: null;
  resizeXY: null;
  move: boolean;
  moveXY: object | null;
  cursorStartPosition: { x: number; y: number } | null;
};

export const imageProps: ImageProps = {
  defaultWidth: 144,
  defaultHeight: 84,
  currentObj: null,
  currentWinW: null,
  currentWinH: null,
  resize: null,
  resizeXY: null,
  move: false,
  moveXY: null,
  cursorStartPosition: null,
};

const PASTE_OFFSET = 20;

function ensureCopyContentEl(): HTMLElement {
  let ele = document.getElementById('fortune-copy-content');
  if (!ele) {
    ele = document.createElement('div');
    ele.setAttribute('contentEditable', 'true');
    ele.id = 'fortune-copy-content';
    ele.style.position = 'fixed';
    ele.style.height = '0';
    ele.style.width = '0';
    ele.style.left = '-10000px';
    document.querySelector('.fortune-container')?.append(ele);
  }
  return ele;
}

function buildImageCopyHtml(img: Image): string {
  return `<div data-type="fortune-copy-action-image" data-width="${img.width}" data-height="${img.height}" data-origin-width="${img.originWidth ?? img.width}" data-origin-height="${img.originHeight ?? img.height}"><img src="${img.src}" alt="" /></div>`;
}

/** Sync in-app copy buffer without relying on execCommand during Ctrl/Cmd+C. */
function writeImageCopyBuffer(html: string) {
  const ele = ensureCopyContentEl();
  ele.innerHTML = html;
  try {
    sessionStorage.setItem('localClipboard', '');
  } catch {
    // ignore
  }

  // Best-effort system clipboard. Avoid execCommand('copy') here — during a
  // Ctrl/Cmd+C keydown many browsers ignore or overwrite it with an empty selection.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([''], { type: 'text/plain' }),
    });
    void navigator.clipboard.write([item]).catch(() => {
      // In-app imageClipboard + fortune-copy-content are enough for sheet paste
    });
  }
}

export function generateRandomId(prefix: string) {
  if (prefix == null) {
    prefix = 'img';
  }

  const userAgent = window.navigator.userAgent
    .replace(/[^a-zA-Z0-9]/g, '')
    .split('');

  let mid = '';

  for (let i = 0; i < 12; i += 1) {
    mid += userAgent[Math.round(Math.random() * (userAgent.length - 1))];
  }

  const time = new Date().getTime();

  return `${prefix}_${mid}_${time}`;
}

export function showImgChooser() {
  const chooser = document.getElementById(
    'fortune-img-upload',
  ) as HTMLInputElement;
  if (chooser) chooser.click();
}

export function saveImage(ctx: Context) {
  const index = getSheetIndex(ctx, ctx.currentSheetId);
  if (index == null) return;
  const file = ctx.luckysheetfile[index];

  file.images = ctx.insertedImgs;
}

export function removeActiveImage(ctx: Context) {
  ctx.insertedImgs = _.filter(
    ctx.insertedImgs,
    (image) => image.id !== ctx.activeImg,
  );
  ctx.activeImg = undefined;
  saveImage(ctx);
}

function getSelectionAnchorPosition(ctx: Context): { left: number; top: number } {
  const last =
    ctx.luckysheet_select_save?.[ctx.luckysheet_select_save.length - 1];
  let rowIndex = last?.row_focus;
  let colIndex = last?.column_focus;
  if (!last) {
    rowIndex = 0;
    colIndex = 0;
  } else {
    if (rowIndex == null) {
      [rowIndex] = last.row;
    }
    if (colIndex == null) {
      [colIndex] = last.column;
    }
  }
  const flowdata = getFlowdata(ctx);
  let left = colIndex === 0 ? 0 : ctx.visibledatacolumn[colIndex - 1];
  let top = rowIndex === 0 ? 0 : ctx.visibledatarow[rowIndex - 1];
  if (flowdata) {
    const margeset = mergeBorder(ctx, flowdata, rowIndex, colIndex);
    if (margeset) {
      [top] = margeset.row;
      [left] = margeset.column;
    }
  }
  return { left, top };
}

function addImageToSheet(ctx: Context, img: Image, select = true) {
  ctx.insertedImgs = (ctx.insertedImgs || []).concat(img);
  if (select) {
    ctx.activeImg = img.id;
  }
  saveImage(ctx);
}

export function insertImage(ctx: Context, image: HTMLImageElement) {
  try {
    const { left, top } = getSelectionAnchorPosition(ctx);
    const { width } = image;
    const { height } = image;
    const img: Image = {
      id: generateRandomId('img'),
      src: image.src,
      left,
      top,
      width: width * 0.5,
      height: height * 0.5,
      originWidth: width,
      originHeight: height,
    };
    addImageToSheet(ctx, img);
  } catch (err) {
    console.info(err);
  }
}

/** Copy/cut the currently selected floating image onto the clipboard. */
export function copyActiveImage(ctx: Context): boolean {
  if (ctx.activeImg == null) return false;
  const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
  if (!img) return false;

  setImageClipboard(img, false);
  ctx.luckysheet_paste_iscut = false;
  writeImageCopyBuffer(buildImageCopyHtml(img));
  return true;
}

/**
 * Cut: copy into the clipboard but keep the image on the sheet until paste
 * (same deferred-remove behavior as cell Ctrl/Cmd+X).
 */
export function cutActiveImage(ctx: Context): boolean {
  if (ctx.activeImg == null) return false;
  const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
  if (!img) return false;

  setImageClipboard(img, true);
  ctx.luckysheet_paste_iscut = true;
  writeImageCopyBuffer(buildImageCopyHtml(img));
  return true;
}

function parseImageFromCopyHtml(html: string): Image | null {
  if (html.indexOf('fortune-copy-action-image') === -1) return null;
  try {
    const ele = document.createElement('div');
    ele.innerHTML = html;
    const wrapper = ele.querySelector(
      '[data-type="fortune-copy-action-image"]',
    ) as HTMLElement | null;
    const imgEl = wrapper?.querySelector('img') ?? ele.querySelector('img');
    const src = imgEl?.getAttribute('src');
    if (!src) return null;

    const width = Number(
      wrapper?.getAttribute('data-width') || imgEl?.width || 144,
    );
    const height = Number(
      wrapper?.getAttribute('data-height') || imgEl?.height || 84,
    );
    const originWidth = Number(
      wrapper?.getAttribute('data-origin-width') || width,
    );
    const originHeight = Number(
      wrapper?.getAttribute('data-origin-height') || height,
    );

    return {
      id: generateRandomId('img'),
      src,
      left: 0,
      top: 0,
      width: Number.isFinite(width) ? width : 144,
      height: Number.isFinite(height) ? height : 84,
      originWidth: Number.isFinite(originWidth) ? originWidth : width,
      originHeight: Number.isFinite(originHeight) ? originHeight : height,
    };
  } catch {
    return null;
  }
}

/** Paste a previously copied floating image (or one encoded in paste HTML). */
export function pasteImageItem(ctx: Context, html?: string): boolean {
  const fromHtml = html ? parseImageFromCopyHtml(html) : null;
  const cached = getImageClipboard();
  const source = fromHtml ?? cached;
  if (!source) return false;

  const cutSourceId =
    ctx.luckysheet_paste_iscut || getImageCutSourceId()
      ? getImageCutSourceId() ?? cached?.id
      : null;

  const { left: anchorLeft, top: anchorTop } = getSelectionAnchorPosition(ctx);

  const img: Image = {
    ...source,
    id: generateRandomId('img'),
    // Cut → move to current selection; copy → duplicate with a small offset
    left: cutSourceId
      ? anchorLeft
      : Math.max(0, source.left + PASTE_OFFSET),
    top: cutSourceId
      ? anchorTop
      : Math.max(0, source.top + PASTE_OFFSET),
  };

  // Remove original after successful cut-paste (Excel-style)
  if (cutSourceId) {
    ctx.insertedImgs = _.filter(
      ctx.insertedImgs,
      (image) => image.id !== cutSourceId,
    );
    if (ctx.activeImg === cutSourceId) {
      ctx.activeImg = undefined;
    }
    ctx.luckysheet_paste_iscut = false;
    clearImageCutFlag();
  }

  addImageToSheet(ctx, img);
  // After paste, further pastes should duplicate (not cut again)
  setImageClipboard(img, false);
  return true;
}

/** Load an image File (e.g. from the system clipboard) as an HTMLImageElement. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result;
      if (typeof src !== 'string') {
        resolve(null);
        return;
      }
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function getImagePosition() {
  const box = document.getElementById('luckysheet-modal-dialog-activeImage');
  if (!box) return undefined;
  const { width, height } = box.getBoundingClientRect();
  const left = box.offsetLeft;
  const top = box.offsetTop;
  return { left, top, width, height };
}

export function cancelActiveImgItem(ctx: Context, globalCache: GlobalCache) {
  ctx.activeImg = undefined;
  globalCache.image = undefined;
}

export function onImageMoveStart(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
  // { r, c, rc }: { r: number; c: number; rc: string },
) {
  const position = getImagePosition();
  if (position) {
    const { top, left } = position;
    _.set(globalCache, 'image', {
      cursorMoveStartPosition: {
        x: e.pageX,
        y: e.pageY,
      },
      // movingId,
      // imageRC: { r, c, rc },
      imgInitialPosition: { left, top },
    });
  }
}

export function onImageMove(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
) {
  if (ctx.allowEdit === false) return false;
  const image = globalCache?.image;
  const img = document.getElementById('luckysheet-modal-dialog-activeImage');
  if (img && image && !image.resizingSide) {
    const { x: startX, y: startY } = image.cursorMoveStartPosition!;
    let { top, left } = image.imgInitialPosition!;
    left += e.pageX - startX;
    top += e.pageY - startY;
    if (top < 0) top = 0;
    (img as HTMLDivElement).style.left = `${left}px`;
    (img as HTMLDivElement).style.top = `${top}px`;
    return true;
  }
  return false;
}

export function onImageMoveEnd(ctx: Context, globalCache: GlobalCache) {
  const position = getImagePosition();
  if (!globalCache.image?.resizingSide) {
    globalCache.image = undefined;

    if (position) {
      const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
      if (img) {
        img.left = position.left / ctx.zoomRatio;
        img.top = position.top / ctx.zoomRatio;
        saveImage(ctx);
      }
    }
  }
}

export function onImageResizeStart(
  globalCache: GlobalCache,
  e: MouseEvent,
  resizingSide: string,
) {
  const position = getImagePosition();
  if (position) {
    _.set(globalCache, 'image', {
      cursorMoveStartPosition: { x: e.pageX, y: e.pageY },
      resizingSide,
      imgInitialPosition: position,
    });
  }
}

export function onImageResize(
  ctx: Context,
  globalCache: GlobalCache,
  e: MouseEvent,
) {
  if (ctx.allowEdit === false) return false;
  const image = globalCache?.image;
  if (image?.resizingSide) {
    const imgContainer = document.getElementById(
      'luckysheet-modal-dialog-activeImage',
    );
    const img = imgContainer?.querySelector('.luckysheet-modal-dialog-content');
    if (img == null) return false;
    const { x: startX, y: startY } = image.cursorMoveStartPosition!;
    let { top, left, width, height } = image.imgInitialPosition!;
    const dx = e.pageX - startX;
    const dy = e.pageY - startY;
    const minHeight = 60 * ctx.zoomRatio;
    const minWidth = 1.5 * 60 * ctx.zoomRatio;
    if (['lm', 'lt', 'lb'].includes(image.resizingSide)) {
      if (width - dx < minWidth) {
        left += width - minWidth;
        width = minWidth;
      } else {
        left += dx;
        width -= dx;
      }
      if (left < 0) left = 0;
      (img as HTMLDivElement).style.left = `${left}px`;
      (imgContainer as HTMLDivElement).style.left = `${left}px`;
    }
    if (['rm', 'rt', 'rb'].includes(image.resizingSide)) {
      width = width + dx < minWidth ? minWidth : width + dx;
    }
    if (['mt', 'lt', 'rt'].includes(image.resizingSide)) {
      if (height - dy < minHeight) {
        top += height - minHeight;
        height = minHeight;
      } else {
        top += dy;
        height -= dy;
      }
      if (top < 0) top = 0;
      (img as HTMLDivElement).style.top = `${top}px`;
      (imgContainer as HTMLDivElement).style.top = `${top}px`;
    }
    if (['mb', 'lb', 'rb'].includes(image.resizingSide)) {
      height = height + dy < minHeight ? minHeight : height + dy;
    }
    (img as HTMLDivElement).style.width = `${width}px`;
    (imgContainer as HTMLDivElement).style.width = `${width}px`;
    (img as HTMLDivElement).style.height = `${height}px`;
    (imgContainer as HTMLDivElement).style.height = `${height}px`;
    (img as HTMLDivElement).style.backgroundSize = `${width}px ${height}px`;

    return true;
  }
  return false;
}

export function onImageResizeEnd(ctx: Context, globalCache: GlobalCache) {
  if (globalCache.image?.resizingSide) {
    globalCache.image = undefined;
    const position = getImagePosition();
    if (position) {
      const img = _.find(ctx.insertedImgs, (v) => v.id === ctx.activeImg);
      if (img) {
        img.left = position.left / ctx.zoomRatio;
        img.top = position.top / ctx.zoomRatio;
        img.width = position.width / ctx.zoomRatio;
        img.height = position.height / ctx.zoomRatio;
        saveImage(ctx);
      }
    }
  }
}
