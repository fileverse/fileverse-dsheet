// border
export { getBorderInfoComputeRange, getBorderInfoCompute } from './border';

// cell
export {
  normalizedCellAttr,
  normalizedAttr,
  getCellValue,
  setCellValue,
  getRealCellValue,
  mergeBorder,
  cancelNormalSelected,
  updateCell,
  getRangetxt,
  getRangeByTxt,
  getInlineStringHTML,
  getStyleByCell,
  clearSelectedCellFormat,
  clearRowsCellsFormat,
  clearColumnsCellsFormat,
  cancelFunctionrangeSelected,
} from './cell';

// clipboard
export { default as clipboard } from './clipboard';

// cursor
export { moveToEnd, getRangeRectsByCharacterOffset } from './cursor';

// format
export { update, is_date, valueShowEs } from './format';

// formula
export {
  FormulaCache,
  groupValuesRefresh,
  setCaretPosition,
  getrangeseleciton,
  getFormulaEditorOwner,
  rangeHightlightselected,
  handleFormulaInput,
  israngeseleciton,
  createRangeHightlight,
  createFormulaRangeSelect,
  maybeRecoverDirtyRangeSelection,
  delFunctionGroup,
  functionHTMLGenerate,
  onFormulaRangeDragEnd,
  rangeDrag,
  rangeSetValue,
  remapFormulaReferencesByMap,
  getFormulaRangeIndexAtCaret,
  isCaretAtValidFormulaRangeInsertionPoint,
  isLegacyFormulaRangeMode,
  markRangeSelectionDirty,
  getFormulaRangeIndexForKeyboardSync,
  isFormulaReferenceInputMode,
  seedFormulaFuncSelectedRangeFromLastSelection,
  functionStrChange,
  setFormulaEditorOwner,
  getAllFunctionGroup,
  suppressFormulaRangeSelectionForInitialEdit,
} from './formula';

// freeze
export { initFreeze } from './freeze';

// inline-string
export {
  isInlineStringCell,
  getInlineStringNoStyle,
  applyLinkToSelection,
  getHyperlinksFromInlineSegments,
  getUniformLinkFromWindowSelectionInEditor,
  getHyperlinkAtCaretInContentEditable,
} from './inline-string';

// location
export {
  rowLocation,
  rowLocationByIndex,
  colLocation,
  colLocationByIndex,
} from './location';

// rowcol
export {
  insertRowCol,
  deleteRowCol,
  hideSelected,
  showSelected,
  isShowHidenCR,
  hideCRCount,
} from './rowcol';

// selection
export {
  scrollToHighlightCell,
  seletedHighlistByindex,
  selectTitlesMap,
  selectTitlesRange,
  normalizeSelection,
  syncPrimaryCellActiveFromSelection,
  setPrimaryCellActive,
  advancePrimaryCellInLastMultiSelection,
  snapSheetSelectionFocusToCellPreserveMultiRange,
  moveHighlightCell,
  deleteSelectedCellText,
  selectAll,
  fixRowStyleOverflowInFreeze,
  fixColumnStyleOverflowInFreeze,
  calcSelectionInfo,
  rangeValueToHtml,
} from './selection';

// sheet
export {
  addSheet,
  deleteSheet,
  editSheetName,
  changeSheet,
  updateSheet,
} from './sheet';

// text — no direct imports needed from consumers

// toolbar
export {
  updateFormat,
  autoSelectionFormula,
  handleBold,
  handleItalic,
  handleStrikeThrough,
  handleUnderline,
  handleHorizontalAlign,
  handleVerticalAlign,
  handleTextColor,
  handleTextBackground,
  handleBorder,
  handleMerge,
  handleSort,
  handleFreeze,
  handleTextSize,
  handleSum,
  handleLink,
  captureLinkEditorOpenSnapshot,
  toolbarItemClickHandler,
  toolbarItemSelectedFunc,
  updateFormatCell,
  cancelPaintModel,
} from './toolbar';

// screenshot
export { handleScreenShot } from './screenshot';

// comment
export {
  drawArrow,
  setEditingComment,
  removeEditingComment,
  newComment,
  editComment,
  deleteComment,
  showComments,
  showHideComment,
  showHideAllComments,
  onCommentBoxMoveStart,
  onCommentBoxMove,
  onCommentBoxMoveEnd,
  onCommentBoxResize,
  onCommentBoxResizeEnd,
  removeOverShowComment,
} from './comment';

// image
export {
  showImgChooser,
  insertImage,
  removeActiveImage,
  cancelActiveImgItem,
  onImageMoveStart,
  onImageResizeStart,
  onImageMove,
  onImageMoveEnd,
  onImageResize,
  onImageResizeEnd,
} from './image';

// dropCell
export {
  createDropCellRange,
  dropCellCache,
  getTypeItemHide,
  updateDropCell,
} from './dropCell';

// merge
export { mergeCells } from './merge';

// sort
export { sortSelection, spillSortResult } from './sort';

// screenshot — handleScreenShot already exported from toolbar

// searchReplace
export { searchAll, searchNext, replace, replaceAll } from './searchReplace';

// hyperlink
export {
  getCellRowColumn,
  getCellHyperlink,
  getCellHyperlinks,
  getHyperlinkDisplayTextInCell,
  getInlineLinkPlainRange,
  getUniformLinkCoveringPlainRange,
  getUniformLinkAtPlainOffset,
  saveHyperlink,
  removeHyperlink,
  removeHyperlinkForLink,
  updateHyperlinkForLink,
  syncLinkCardAfterHyperlinkChange,
  showLinkCard,
  goToLink,
  isLinkValid,
} from './hyperlink';

// filter
export {
  createFilterOptions,
  clearFilter,
  createFilter,
  getFilterColumnValues,
  getFilterColumnColors,
  orderbydatafiler,
  saveFilter,
} from './filter';
export type { FilterDate, FilterValue, FilterColor } from './filter';

// moveCells
export { onCellsMoveStart, onCellsMove, onCellsMoveEnd } from './moveCells';

// conditionalFormat
export { cfSplitRange } from './conditionalFormat';

// ConditionFormat (additional internal exports)
export { CFSplitRange } from './ConditionFormat';

// splitColumn
export { updateMoreCell, getRegStr, getDataArr } from './splitColumn';

// locationCondition
export {
  applyLocation,
  getOptionValue,
  getSelectRange,
} from './locationCondition';

// dataVerification
export {
  getDropdownList,
  setDropdownValue,
  confirmMessage,
  cellFocus,
  validateCellData,
} from './dataVerification';

// ConditionFormat
export { setConditionRules } from './ConditionFormat';

// mobile
export { handleOverlayTouchStart, handleOverlayTouchEnd } from './mobile';

// zoom
export { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO, handleKeydownForZoom } from './zoom';

// refresh
export { jfrefreshgrid } from './refresh';

// iframe
export {
  sanitizeDuneUrl,
  insertDuneChart,
  onIframeMoveStart,
  onIframeResizeStart,
  onIframeMove,
  onIframeMoveEnd,
  onIframeResize,
  onIframeResizeEnd,
} from './iframe';

// error-state-helpers (used internally by formula.ts and events/mouse.ts via barrel)
export {
  setCellError,
  clearCellError,
  overShowError,
} from './error-state-helpers';

// protection (used internally by utils/index.ts)
export { checkCellIsLocked } from './protection';

// validation (used internally by text.ts, dataVerification.ts, sort.ts via barrel)
export {
  isdatatypemulti,
  diff,
  isdatetime,
  isRealNull,
  isRealNum,
  isNumericCellType,
} from './validation';

// formula (additional internal exports)
export {
  iscelldata,
  getcellrange,
  execfunction,
  execFunctionGroup,
  insertUpdateFunctionGroup,
  functionCopy,
} from './formula';

// ConditionFormat (additional internal exports)
export { checkCF, getComputeMap } from './ConditionFormat';

// cell (additional internal exports)
export { getdatabyselection, getQKBorder } from './cell';
