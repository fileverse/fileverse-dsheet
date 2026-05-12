/** Re-export paste module (Fortune-first architecture lives under `core/paste/`). */
export {
  handlePaste,
  handlePasteByClick,
  columnLabelIndex,
  indexToColumnLabel,
  FormularCellRefError,
  adjustFormulaForPaste,
  parseAsLinkIfUrl,
} from '../paste';
