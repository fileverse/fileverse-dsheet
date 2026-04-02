import { Workbook, Worksheet } from 'exceljs';
import { Sheet } from '@sheet-engine/react';

export interface RawSheetImage {
  src: string;
  nativeCol: number;
  nativeColOff: number;
  nativeRow: number;
  nativeRowOff: number;
  width: number;
  height: number;
  brNativeCol?: number;
  brNativeColOff?: number;
  brNativeRow?: number;
  brNativeRowOff?: number;
}

export function extractImagesFromWorksheet(
  ws: Worksheet,
  workbook: Workbook,
): RawSheetImage[] {
  const wsImages = ws.getImages();
  if (!wsImages.length) return [];

  const sheetImages: RawSheetImage[] = [];
  for (const img of wsImages) {
    try {
      const imageData = workbook.getImage(Number(img.imageId));
      if (!imageData) continue;

      let base64: string;
      if (imageData.buffer) {
        const arr = new Uint8Array(imageData.buffer as unknown as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < arr.length; i += 8192) {
          binary += String.fromCharCode(...arr.subarray(i, i + 8192));
        }
        base64 = btoa(binary);
      } else if (imageData.base64) {
        base64 = imageData.base64;
      } else {
        continue;
      }

      const ext = imageData.extension ?? 'png';
      const mime = ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      const src = `data:${mime};base64,${base64}`;

      const { tl, br } = img.range;
      // Google Sheets (and some Excel files) use tl+ext instead of tl+br
      const rangeExt = (
        img.range as unknown as { ext?: { width: number; height: number } }
      ).ext;

      sheetImages.push({
        src,
        nativeCol: tl.nativeCol,
        nativeColOff: tl.nativeColOff,
        nativeRow: tl.nativeRow,
        nativeRowOff: tl.nativeRowOff,
        width: rangeExt ? Math.max(Math.round(rangeExt.width), 20) : 0,
        height: rangeExt ? Math.max(Math.round(rangeExt.height), 20) : 0,
        brNativeCol: br?.nativeCol,
        brNativeColOff: br?.nativeColOff,
        brNativeRow: br?.nativeRow,
        brNativeRowOff: br?.nativeRowOff,
      });
    } catch {
      // skip unreadable images
    }
  }
  return sheetImages;
}

const EMU_TO_PX = 9525;
const COL_GRIDLINE_PX = 1;
const ROW_GRIDLINE_PX = 2;

export function convertRawImagesToFortuneSheet(
  rawImages: RawSheetImage[],
  sheet: Sheet,
  defaultColPx: number,
  defaultRowPx: number,
) {
  const nativeColToPx = (nativeCol: number, nativeColOff: number) => {
    let px = 0;
    for (let c = 0; c < nativeCol; c++) {
      px += (sheet.config?.columnlen?.[c] ?? defaultColPx) + COL_GRIDLINE_PX;
    }
    return Math.round(px + nativeColOff / EMU_TO_PX);
  };

  const nativeRowToPx = (nativeRow: number, nativeRowOff: number) => {
    let px = 0;
    for (let r = 0; r < nativeRow; r++) {
      px += (sheet.config?.rowlen?.[r] ?? defaultRowPx) + ROW_GRIDLINE_PX;
    }
    return Math.round(px + nativeRowOff / EMU_TO_PX);
  };

  return rawImages.map((raw) => {
    const left = nativeColToPx(raw.nativeCol, raw.nativeColOff);
    const top = nativeRowToPx(raw.nativeRow, raw.nativeRowOff);

    let { width, height } = raw;

    if (!width && raw.brNativeCol != null) {
      width = Math.max(
        nativeColToPx(raw.brNativeCol, raw.brNativeColOff ?? 0) - left,
        20,
      );
    }

    if (!height && raw.brNativeRow != null) {
      height = Math.max(
        nativeRowToPx(raw.brNativeRow, raw.brNativeRowOff ?? 0) - top,
        20,
      );
    }

    return {
      id: `img_imported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      src: raw.src,
      left,
      top,
      width: Math.max(width, 20),
      height: Math.max(height, 20),
    };
  });
}
