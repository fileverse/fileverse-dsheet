import type { Image } from '../types';

/** In-app clipboard payload for floating images (copy/cut → paste). */
let imageClipboard: Image | null = null;
/** When set, the next image paste must remove this id (Excel-style cut). */
let imageCutSourceId: string | null = null;
/** Sheet that owns the cut image (needed for cross-sheet cut → paste). */
let imageCutSourceSheetId: string | null = null;

export function getImageClipboard(): Image | null {
  return imageClipboard ? { ...imageClipboard } : null;
}

export function getImageCutSourceId(): string | null {
  return imageCutSourceId;
}

export function getImageCutSourceSheetId(): string | null {
  return imageCutSourceSheetId;
}

export function setImageClipboard(
  img: Image | null,
  asCut = false,
  sheetId: string | null = null,
) {
  imageClipboard = img ? { ...img } : null;
  imageCutSourceId = asCut && img ? img.id : null;
  imageCutSourceSheetId = asCut && img ? sheetId : null;
}

export function clearImageClipboard() {
  imageClipboard = null;
  imageCutSourceId = null;
  imageCutSourceSheetId = null;
}

export function clearImageCutFlag() {
  imageCutSourceId = null;
  imageCutSourceSheetId = null;
}
