/** Fortune-first paste: routing in `fortune-internal-paste`, handlers in `paste-internals`, wire-up in `clipboard-entry`. */
export {
  columnLabelIndex,
  indexToColumnLabel,
  FormularCellRefError,
  adjustFormulaForPaste,
} from "./formula-adjust";
export {
  computeFortuneInternalPasteDecision,
  type FortuneInternalPasteDecision,
} from "./fortune-internal-paste";
export {
  parseAsLinkIfUrl,
  pasteHandler,
  pasteHandlerOfCutPaste,
  pasteHandlerOfCopyPaste,
  handleFormulaStringPaste,
  resizePastedCellsToContent,
  shouldHandleNonTableHtml,
  convertAnyHtmlToTable,
} from "./paste-internals";
export { handlePaste, handlePasteByClick } from "./clipboard-entry";
