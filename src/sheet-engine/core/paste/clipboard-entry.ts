/**
 * Clipboard wire-up: Fortune internal paste is decided first (`fortune-internal-paste`),
 * then HTML table / plain / in-cell edit fallbacks re-use `paste-internals` handlers.
 */
import { handlePastedTable } from "../paste-table-helpers";
import type { Context } from "../context";
import { isAllowEdit } from "../utils";
import { selectionCache } from "../modules/selection";
import { sanitizeDuneUrl } from "../modules";
import clipboard from "../modules/clipboard";
import { computeFortuneInternalPasteDecision } from "./fortune-internal-paste";
import {
  convertAnyHtmlToTable,
  handleFormulaStringPaste,
  parseAsLinkIfUrl,
  pasteHandler,
  pasteHandlerOfCopyPaste,
  pasteHandlerOfCutPaste,
  resizePastedCellsToContent,
  shouldHandleNonTableHtml,
} from "./paste-internals";

export function handlePaste(ctx: Context, e: ClipboardEvent) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit || ctx.isFlvReadOnly) return;

  if (!selectionCache.isPasteAction) {
    return;
  }

  if (selectionCache.isPasteAction) {
    ctx.luckysheetCellUpdate = [];
    selectionCache.isPasteAction = false;
    const pasteValuesOnly = selectionCache.isPasteValuesOnly;
    selectionCache.isPasteValuesOnly = false;

    let { clipboardData } = e;
    if (!clipboardData) {
      // @ts-ignore
      clipboardData = window.clipboardData;
    }

    if (!clipboardData) return;
    const text = clipboardData.getData("text/plain");
    if (text) {
      parseAsLinkIfUrl(text, ctx);
    }

    let txtdata =
      clipboardData.getData("text/html") || clipboardData.getData("text/plain");

    if (
      pasteValuesOnly &&
      txtdata.indexOf("fortune-copy-action-table") === -1 &&
      txtdata.indexOf("fortune-copy-action-span") === -1
    ) {
      txtdata = clipboardData.getData("text/plain");
    }

    const __fortT0 = performance.now();
    const fortunePaste = computeFortuneInternalPasteDecision(ctx, txtdata);
    const __fortT1 = performance.now();
    if (fortunePaste.abortPaste) {
      return;
    }
    const { internalFortunePaste } = fortunePaste;

    if (
      ctx.hooks.beforePaste?.(ctx.luckysheet_select_save, txtdata) === false
    ) {
      return;
    }

    if (
      (txtdata.indexOf("fortune-copy-action-table") > -1 ||
        txtdata.indexOf("fortune-copy-action-span") > -1) &&
      ctx.luckysheet_copy_save?.copyRange != null &&
      ctx.luckysheet_copy_save.copyRange.length > 0 &&
      internalFortunePaste
    ) {
      const __ip0 = performance.now();
      if (ctx.luckysheet_paste_iscut) {
        ctx.luckysheet_paste_iscut = false;
        pasteHandlerOfCutPaste(ctx, ctx.luckysheet_copy_save);
        ctx.luckysheet_selection_range = [];
      } else {
        pasteHandlerOfCopyPaste(ctx, ctx.luckysheet_copy_save, pasteValuesOnly);
      }
      const __ip1 = performance.now();
      resizePastedCellsToContent(ctx);
      const __ip2 = performance.now();
      // #region agent log
      fetch("http://127.0.0.1:7807/ingest/fc498105-2ce8-4b6c-9c08-4e5af4351528", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "62e6c9",
        },
        body: JSON.stringify({
          sessionId: "62e6c9",
          runId: "pre",
          hypothesisId: "H1-H5",
          location: "clipboard-entry.ts:internal-fortune-paste",
          message: "paste path timings",
          data: {
            fortuneDecisionMs: __fortT1 - __fortT0,
            pasteHandlerMs: __ip1 - __ip0,
            resizeAfterPasteMs: __ip2 - __ip1,
            internalFortunePaste: true,
            strippedMeta: ctx.lastInternalCopyHtmlMetadataStripped === true,
            txtLen: txtdata.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } else if (txtdata.indexOf("fortune-copy-action-image") > -1) {
      // imageCtrl.pasteImgItem();
    } else {
      const shouldHandleAsHtml =
        /<table[\s/>]/i.test(txtdata) || shouldHandleNonTableHtml(txtdata);

      if (shouldHandleAsHtml) {
        const hasNativeTable = /<table[\s/>]/i.test(txtdata);
        const converted = hasNativeTable
          ? txtdata
          : convertAnyHtmlToTable(txtdata);
        handlePastedTable(ctx, converted, pasteHandler);
        if (hasNativeTable) {
          resizePastedCellsToContent(ctx);
        }
      } else if (
        clipboardData.files.length === 1 &&
        clipboardData.files[0].type.indexOf("image") > -1
      ) {
        // imageCtrl.insertImg(clipboardData.files[0]);
      } else {
        txtdata = clipboardData.getData("text/plain");
        const isExcelFormula = txtdata.startsWith("=");

        if (isExcelFormula) {
          handleFormulaStringPaste(ctx, txtdata);
        } else {
          pasteHandler(ctx, txtdata);

          const _txtdata =
            clipboardData.getData("text/html") ||
            clipboardData.getData("text/plain");
          const embedUrl = sanitizeDuneUrl(_txtdata);
          if (embedUrl) {
            const last =
              ctx.luckysheet_select_save?.[
                ctx.luckysheet_select_save.length - 1
              ];
            if (last) {
              const rowIndex = last.row_focus ?? last.row?.[0] ?? 0;
              const colIndex = last.column_focus ?? last.column?.[0] ?? 0;

              const left =
                colIndex === 0 ? 0 : ctx.visibledatacolumn[colIndex - 1];
              const top = rowIndex === 0 ? 0 : ctx.visibledatarow[rowIndex + 5];
              ctx.showDunePreview = {
                url: txtdata,
                position: { left, top },
              };
            }
          }
        }
        resizePastedCellsToContent(ctx);
      }
    }
  } else if (ctx.luckysheetCellUpdate.length > 0) {
    e.preventDefault();

    let { clipboardData } = e;
    if (!clipboardData) {
      // @ts-ignore
      clipboardData = window.clipboardData;
    }
    const text = clipboardData?.getData("text/plain");
    if (text) {
      document.execCommand("insertText", false, text);
      parseAsLinkIfUrl(text, ctx);
      resizePastedCellsToContent(ctx);
    }
  }
}

export function handlePasteByClick(
  ctx: Context,
  clipboardData: string,
  triggerType?: string
) {
  const allowEdit = isAllowEdit(ctx);
  if (!allowEdit || ctx.isFlvReadOnly) return;

  if (clipboardData) {
    const htmlWithPreservedNewlines = `<pre style="white-space: pre-wrap;">${clipboardData}</pre>`;
    clipboard.writeHtml(htmlWithPreservedNewlines);
  }

  const textarea = document.querySelector("#fortune-copy-content");
  const data = textarea?.innerHTML || textarea?.textContent;
  if (!data) return;

  if (ctx.hooks.beforePaste?.(ctx.luckysheet_select_save, data) === false) {
    return;
  }

  const fortunePaste = computeFortuneInternalPasteDecision(ctx, data);
  if (fortunePaste.abortPaste) {
    return;
  }
  const { internalFortunePaste } = fortunePaste;

  if (
    (data.indexOf("fortune-copy-action-table") > -1 ||
      data.indexOf("fortune-copy-action-span") > -1) &&
    ctx.luckysheet_copy_save?.copyRange != null &&
    ctx.luckysheet_copy_save.copyRange.length > 0 &&
    internalFortunePaste
  ) {
    if (ctx.luckysheet_paste_iscut) {
      ctx.luckysheet_paste_iscut = false;
      pasteHandlerOfCutPaste(ctx, ctx.luckysheet_copy_save);
    } else {
      pasteHandlerOfCopyPaste(ctx, ctx.luckysheet_copy_save);
    }
  } else if (data.indexOf("fortune-copy-action-image") > -1) {
    // imageCtrl.pasteImgItem();
  } else if (triggerType !== "btn") {
    const isExcelFormula = clipboardData.startsWith("=");

    if (isExcelFormula) {
      handleFormulaStringPaste(ctx, clipboardData);
    } else {
      pasteHandler(ctx, clipboardData);
    }
  }
}
