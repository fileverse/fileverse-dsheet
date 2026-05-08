import _ from "lodash";
import type { Context } from "../context";
import { getFlowdata } from "../context";
import { getCellValue } from "../modules/cell";
import { getSheetIndex } from "../utils";

/** Same rule as `rangeValueToHtml`: only these `ct.fa` patterns embed raw value in copied HTML. */
const FORTUNE_COPY_WEALTH_FA_REG = /^(w|W)((0?)|(0\.0+))$/;

function fortuneClipboardTdToPlainText(tdHtml: string): string {
  const inner = tdHtml
    .replace(/^<td\b[^>]*>/i, "")
    .replace(/<\/td>\s*$/i, "");
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = inner;
    const t = (el.textContent || el.innerText || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    return t.trim();
  }
  return inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export type FortuneInternalPasteDecision = {
  /** True when clipboard/grid prep must stop (e.g. missing copy source data). */
  abortPaste: boolean;
  /** True when paste should use `pasteHandlerOfCopyPaste` / cut handler for Fortune HTML. */
  internalFortunePaste: boolean;
};

/**
 * Decides whether pasted HTML corresponds to the last in-app Fortune copy so we can use
 * the internal paste path (grid + `luckysheet_copy_save`) instead of HTML table parsing.
 */
export function computeFortuneInternalPasteDecision(
  ctx: Context,
  txtdata: string
): FortuneInternalPasteDecision {
  let isEqual = true;
  let internalFortunePaste = false;

  if (
    txtdata.indexOf("fortune-copy-action-span") > -1 &&
    ctx.luckysheet_copy_save?.copyRange != null &&
    ctx.luckysheet_copy_save.copyRange.length === 1
  ) {
    return { abortPaste: false, internalFortunePaste: true };
  }

  if (
    txtdata.indexOf("fortune-copy-action-table") > -1 &&
    ctx.luckysheet_copy_save?.copyRange != null &&
    ctx.luckysheet_copy_save.copyRange.length > 0
  ) {
    // Large internal copies strip `data-fortune-cell`; skip expensive HTML parse — use grid path.
    if (ctx.lastInternalCopyHtmlMetadataStripped === true) {
      return { abortPaste: false, internalFortunePaste: true };
    }

    const cpDataArr: string[][] = [];

    const reg = /<tr.*?>(.*?)<\/tr>/g;
    const reg2 = /<td.*?>(.*?)<\/td>/g;

    const regArr = txtdata.match(reg) || [];

    for (let i = 0; i < regArr.length; i += 1) {
      const cpRowArr: string[] = [];

      const reg2Arr = regArr[i].match(reg2);

      if (!_.isNil(reg2Arr)) {
        for (let j = 0; j < reg2Arr.length; j += 1) {
          cpRowArr.push(fortuneClipboardTdToPlainText(reg2Arr[j]));
        }
      }

      cpDataArr.push(cpRowArr);
    }

    const copy_r1 = ctx.luckysheet_copy_save?.copyRange[0]?.row[0];
    const copy_r2 = ctx.luckysheet_copy_save?.copyRange[0]?.row[1];
    const copy_c1 = ctx.luckysheet_copy_save?.copyRange[0]?.column[0];
    const copy_c2 = ctx.luckysheet_copy_save?.copyRange[0]?.column[1];

    const copy_index =
      ctx.luckysheet_copy_save.dataSheetId || ctx.currentSheetId;
    let d;
    if (copy_index === ctx.currentSheetId) {
      d = getFlowdata(ctx);
    } else {
      const index = getSheetIndex(ctx, copy_index);
      if (_.isNil(index)) {
        return { abortPaste: true, internalFortunePaste: false };
      }
      d = ctx.luckysheetfile[index].data;
    }
    if (!d) {
      return { abortPaste: true, internalFortunePaste: false };
    }

    const filteredHiddenRows = new Set<number>();
    if (
      copy_index === ctx.currentSheetId &&
      !_.isNil(ctx.luckysheet_filter_save) &&
      !_.isEmpty(ctx.filter)
    ) {
      Object.values(ctx.filter || {}).forEach((entry: any) => {
        const rowhidden: Record<string, number> | undefined = entry?.rowhidden;
        if (!rowhidden) return;
        Object.keys(rowhidden).forEach((rk) => {
          const n = Number(rk);
          if (!Number.isNaN(n)) filteredHiddenRows.add(n);
        });
      });
    }
    const visibleRows: number[] = [];
    for (let r = copy_r1; r <= copy_r2; r += 1) {
      if (!filteredHiddenRows.has(r)) {
        visibleRows.push(r);
      }
    }

    for (let rowIdx = 0; rowIdx < visibleRows.length; rowIdx += 1) {
      if (rowIdx > cpDataArr.length - 1) {
        isEqual = false;
        break;
      }
      const r = visibleRows[rowIdx];
      const clipRow = cpDataArr[rowIdx];
      let ci = 0;
      for (let c = copy_c1; c <= copy_c2; c += 1) {
        const cell = d[r][c];
        if (!_.isNil(cell) && !_.isNil(cell.mc) && _.isNil(cell.mc.rs)) {
          continue;
        }

        let isInlineStr = false;
        let v: any;
        if (!_.isNil(cell)) {
          if (
            !_.isNil(cell.ct) &&
            !_.isNil(cell.ct.fa) &&
            FORTUNE_COPY_WEALTH_FA_REG.test(cell.ct.fa)
          ) {
            v = getCellValue(r, c, d);
          } else {
            v = getCellValue(r, c, d, "m");
          }
        } else {
          v = "";
        }

        if (_.isNil(v) && d[r]?.[c]?.ct?.t === "inlineStr") {
          v = d[r]![c]!.ct!.s!.map((val: any) => val.v).join("");
          isInlineStr = true;
        }
        if (_.isNil(v)) {
          v = "";
        }
        const clipPlain = String(clipRow[ci] ?? "").trim();
        if (isInlineStr) {
          ci += 1;
        } else {
          const cellPlain = String(v ?? "").trim();
          ci += 1;
          if (clipPlain !== cellPlain) {
            isEqual = false;
            break;
          }
        }
      }
      if (!isEqual) break;
      if (ci !== clipRow.length) {
        isEqual = false;
        break;
      }
    }

    internalFortunePaste = isEqual;
  }

  return { abortPaste: false, internalFortunePaste };
}
