// Main component
export { default as DSheetEditor } from './editor/dsheet-editor';

// Utilities
export { formulaResponseUiSync } from './editor/utils/formula-ui-sync';
export { executeStringFunction } from './editor/utils/executeStringFunction';
export { FLVURL } from '@fileverse-dev/formulajs';
export { loadLocale } from '@sheet-engine/core';

// Types
export type { ErrorMessageHandlerReturnType } from './editor/types';
export type { WorkbookInstance } from '@sheet-engine/react';

// Constants
export {
  ERROR_MESSAGES_FLAG,
  SERVICES_API_KEY,
} from './editor/constants/shared-constants';
export { TEMPLATES } from '@fileverse-dev/dsheets-templates';

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
} from '@sheet-engine/core';
export type { PatchOptions } from '@sheet-engine/core';
