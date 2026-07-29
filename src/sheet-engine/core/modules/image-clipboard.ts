import type { Image } from '../types';

/** In-app clipboard payload for floating images (copy/cut → paste). */
let imageClipboard: Image | null = null;
/** When set, paste should remove this image id (Excel-style cut). */
let imageCutSourceId: string | null = null;

export function getImageClipboard(): Image | null {
  return imageClipboard ? { ...imageClipboard } : null;
}

export function getImageCutSourceId(): string | null {
  return imageCutSourceId;
}

export function setImageClipboard(img: Image | null, asCut = false) {
  imageClipboard = img ? { ...img } : null;
  imageCutSourceId = asCut && img ? img.id : null;
}

export function clearImageClipboard() {
  imageClipboard = null;
  imageCutSourceId = null;
}

export function clearImageCutFlag() {
  imageCutSourceId = null;
}
