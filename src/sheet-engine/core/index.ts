import * as api from './api';

export { api };

// canvas
export { Canvas, defaultStyle } from './canvas';

// context
export {
  defaultContext,
  getFlowdata,
  ensureSheetIndex,
  initSheetIndex,
  updateContextWithSheetData,
  updateContextWithCanvas,
} from './context';
export type { Context } from './context';

// settings
export { defaultSettings } from './settings';
export type { Settings, Hooks } from './settings';

// events
export {
  handleCopy,
  handleGlobalKeyDown,
  handlePaste,
  handlePasteByClick,
  fixPositionOnFrozenCells,
  handleCellAreaMouseDown,
  handleCellAreaDoubleClick,
  handleContextMenu,
  mouseRender,
  handleOverlayMouseMove,
  handleOverlayMouseUp,
  handleRowHeaderMouseDown,
  handleColumnHeaderMouseDown,
  handleColSizeHandleMouseDown,
  handleColSizeHandleDoubleClick,
  handleRowSizeHandleMouseDown,
  handleColFreezeHandleMouseDown,
  handleRowFreezeHandleMouseDown,
} from './events';

// locale
export * from './locale';

// modules
export {
  // border
  getBorderInfoComputeRange,
  getBorderInfoCompute,
  // cell
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
  // clipboard
  clipboard,
  // cursor
  moveToEnd,
  getRangeRectsByCharacterOffset,
  // format
  update,
  is_date,
  valueShowEs,
  // formula
  FormulaCache,
  groupValuesRefresh,
  setCaretPosition,
  getrangeseleciton,
  getFormulaEditorOwner,
  rangeHightlightselected,
  handleFormulaInput,
  israngeseleciton,
  createRangeHightlight,
  maybeRecoverDirtyRangeSelection,
  getFormulaRangeIndexAtCaret,
  isCaretAtValidFormulaRangeInsertionPoint,
  markRangeSelectionDirty,
  setFormulaEditorOwner,
  functionHTMLGenerate,
  suppressFormulaRangeSelectionForInitialEdit,
  rangeSetValue,
  getFormulaRangeIndexForKeyboardSync,
  createFormulaRangeSelect,
  isFormulaReferenceInputMode,
  // freeze
  initFreeze,
  // inline-string
  isInlineStringCell,
  getInlineStringNoStyle,
  // location
  rowLocation,
  rowLocationByIndex,
  colLocation,
  colLocationByIndex,
  // rowcol
  insertRowCol,
  deleteRowCol,
  hideSelected,
  showSelected,
  isShowHidenCR,
  // selection
  scrollToHighlightCell,
  selectTitlesMap,
  selectTitlesRange,
  normalizeSelection,
  moveHighlightCell,
  deleteSelectedCellText,
  selectAll,
  fixRowStyleOverflowInFreeze,
  fixColumnStyleOverflowInFreeze,
  calcSelectionInfo,
  // sheet
  addSheet,
  deleteSheet,
  editSheetName,
  changeSheet,
  // toolbar
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
  toolbarItemClickHandler,
  toolbarItemSelectedFunc,
  handleScreenShot,
  insertImage,
  showImgChooser,
  // comment
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
  // image
  removeActiveImage,
  cancelActiveImgItem,
  onImageMoveStart,
  onImageResizeStart,
  // dropCell
  createDropCellRange,
  // sort
  sortSelection,
  // searchReplace
  searchAll,
  searchNext,
  replace,
  replaceAll,
  // hyperlink
  getCellRowColumn,
  getCellHyperlink,
  saveHyperlink,
  removeHyperlink,
  showLinkCard,
  goToLink,
  isLinkValid,
  // filter
  createFilterOptions,
  clearFilter,
  createFilter,
  getFilterColumnValues,
  getFilterColumnColors,
  orderbydatafiler,
  saveFilter,
  // moveCells
  onCellsMoveStart,
  // conditionalFormat
  cfSplitRange,
  // splitColumn
  updateMoreCell,
  getRegStr,
  getDataArr,
  // locationCondition
  applyLocation,
  getOptionValue,
  getSelectRange,
  // dataVerification
  getDropdownList,
  setDropdownValue,
  confirmMessage,
  // ConditionFormat
  setConditionRules,
  // mobile
  handleOverlayTouchStart,
  handleOverlayTouchEnd,
  // zoom
  MAX_ZOOM_RATIO,
  MIN_ZOOM_RATIO,
  handleKeydownForZoom,
  // refresh
  jfrefreshgrid,
  // iframe
  sanitizeDuneUrl,
  insertDuneChart,
  onIframeMoveStart,
  onIframeResizeStart,
  onIframeMove,
  onIframeMoveEnd,
  onIframeResize,
  onIframeResizeEnd,
  // error-state-helpers (internal)
  setCellError,
  clearCellError,
  // validation (internal)
  isdatatypemulti,
  diff,
  isdatetime,
  isRealNull,
  isRealNum,
  // formula (internal)
  iscelldata,
  getcellrange,
  // cell (internal)
  cancelFunctionrangeSelected,
  // selection (internal)
  seletedHighlistByindex,
  // sort (internal)
  spillSortResult,
  // formula (internal)
  execfunction,
  insertUpdateFunctionGroup,
  remapFormulaReferencesByMap,
  // ConditionFormat (internal)
  checkCF,
  getComputeMap,
  // toolbar (internal)
  cancelPaintModel,
  // rowcol (internal)
  hideCRCount,
  // cell (internal)
  getdatabyselection,
} from './modules';
export type { FilterDate, FilterValue, FilterColor } from './modules';

// utils
export {
  getFreezeState,
  toggleFreeze,
  indexToColumnChar,
  escapeScriptTag,
  escapeHTMLTag,
  getSheetIndex,
  replaceHtml,
  isAllowEdit,
  isAllowEditReadOnly,
  filterPatch,
  patchToOp,
  opToPatch,
  inverseRowColOptions,
} from './utils';
export type { PatchOptions, ChangedSheet } from './utils';

// types
export type {
  Op,
  Cell,
  CellWithRowAndCol,
  CellMatrix,
  Selection,
  Presence,
  Sheet,
  GlobalCache,
  SingleRange,
  Range,
  SearchResult,
  LinkCardProps,
  LiveQueryData,
  Freezen,
} from './types';

// animate
export { cellFadeAnimator, markCellChanged } from './animate';
