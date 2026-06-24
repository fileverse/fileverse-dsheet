// Main component
export { default as DSheetEditor } from './editor/dsheet-editor';
export { default as DSheetSkeleton } from './editor/components/skeleton-loader';

// Utilities
export { formulaResponseUiSync } from './editor/utils/formula-ui-sync';
export { executeStringFunction } from './editor/utils/executeStringFunction';
export { FLVURL } from '@fileverse-dev/formulajs';
export { loadLocale } from '@sheet-engine/core';

// Types
export type { ErrorMessageHandlerReturnType } from './editor/types';
export type { WorkbookInstance } from '@sheet-engine/react';
export type {
  CollaborationProps,
  CollabConnectionConfig,
  CollabSessionMeta,
  CollabServices,
  CollabCallbacks,
  CollabState,
  CollabStatus,
  CollabError,
  CollabErrorCode,
  CollabUser,
} from './sync-local/types';

// Constants
export {
  ERROR_MESSAGES_FLAG,
  SERVICES_API_KEY,
} from './editor/constants/shared-constants';
// Subpath import avoids the package barrel (`index.js`), which statically
// re-exports heavy JSON — bundlers would otherwise pull all templates into the graph.
export { TEMPLATES } from '@fileverse-dev/dsheets-templates/template-metadata-list';

// Import/Export utilities
export { handleCSVUpload } from './editor/utils/csv-import';
export { handleExportToXLSX } from './editor/utils/xlsx-export';
export { handleExportToCSV } from './editor/utils/csv-export';
export { handleExportToJSON } from './editor/utils/json-export';
export { useXLSXImport } from './editor/hooks/use-xlsx-import';

// Full fortune-core namespace (used by dsheets.new as FortuneCore.*)
export * as FortuneCore from '@sheet-engine/core';

// Named re-exports from fortune-core used directly by dsheets.new navbar
export {
  // data-menu.tsx
  createFilter,
  clearFilter,
  handleSort,
  // edit-menu.tsx
  handleCopy,
  handlePasteByClick,
  removeActiveImage,
  jfrefreshgrid,
  deleteSelectedCellText,
  deleteRowCol,
  // format-menu.tsx
  getFlowdata,
  updateFormat,
  handleTextSize,
  handleHorizontalAlign,
  handleVerticalAlign,
  toolbarItemClickHandler,
  getSheetIndex,
  handleMerge,
  clearSelectedCellFormat,
  clearColumnsCellsFormat,
  clearRowsCellsFormat,
  // view-menu.tsx
  handleFreeze,
  // insert-menu.tsx
  insertRowCol,
  showImgChooser,
  handleLink,
  // common
  api,
<<<<<<< HEAD
  isOpenShortcutsModalShortcut,
  isFormulaListShortcut,
  isZoomInShortcut,
  isZoomOutShortcut,
=======
  describeMatchedShortcut,
  isBrowserZoomShortcut,
  isFormulaListShortcut,
  isOpenShortcutsModalShortcut,
>>>>>>> 2cfe7e8 (fix: pass browser zoom through on AZERTY and remove sheet keyboard zoom (2.0.36-shortcut-3))
} from '@sheet-engine/core';
export type { PatchOptions } from '@sheet-engine/core';
