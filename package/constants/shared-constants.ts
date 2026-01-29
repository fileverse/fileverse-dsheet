/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Temporary workaround to safely re-export constants with types from `@fileverse-dev/fortune-react`.
 */
import type {
  //@ts-ignore
  ERROR_MESSAGES_FLAG as ErrorMessagesFlagType,
  //@ts-ignore
  SERVICES_API_KEY as ServicesApiKeyType,
} from '@fileverse-dev/fortune-react';
import {
  //@ts-ignore
  ERROR_MESSAGES_FLAG as RawErrorMessagesFlag,
  //@ts-ignore
  SERVICES_API_KEY as RawServicesApiKey,
} from '@fileverse-dev/fortune-react';

export const ERROR_MESSAGES_FLAG: ErrorMessagesFlagType = RawErrorMessagesFlag;
export const SERVICES_API_KEY: ServicesApiKeyType = RawServicesApiKey;

export const DEFAULT_SHEET_DATA = [
  {
    id: '0',
    name: 'Sheet1',
    celldata: [],
    config: {},
    order: 0,
    row: 500,
    column: 36,
  },
];

export const TOOL_BAR_ITEMS = [
  'undo',
  'redo',
  'format-painter',
  '|',
  'font',
  '|',
  'font-size',
  '|',
  'bold',
  'italic',
  'strike-through',
  '|',
  'font-color',
  'background',
  '|',
  'border',
  'merge-cell',
  '|',
  'horizontal-align',
  'text-wrap',
  'vertical-align',
  '|',
  'currency',
  'percentage-format',
  'number-decrease',
  'number-increase',
  'format',
  '|',
  'conditionFormat',
  'filter',
  '|',
  'link',
  'comment',
  'image',
  'quick-formula',
  'dataVerification',
  'search',
];

export const CELL_CONTEXT_MENU_ITEMS = [
  'cut',
  'copy',
  'paste',
  'clear',
  '|',
  "insert-row",
  "insert-row-above",
  "insert-column",
  "insert-column-right",
  'cell-delete-row',
  'cell-delete-column',
  // "delete-cell",
  // "hide-row",
  // "hide-column",
  // "set-row-height",
  // "set-column-width",
  '|',
  'conditionFormat',
  'filter',
  'searchReplace',
  'dataVerification',
  'ascSort',
  'desSort',
  '|',
  'chart',
  // 'image',
  'link',
  'data',
  'cell-format',
  'comment',
  'freeze-row',
  '|',
  'clear-format',
];

export const HEADER_CONTEXT_MENU_ITEMS = [
  'cut',
  'copy',
  'paste',
  'clear',
  '|',
  "insert-row",
  "insert-row-above",
  "insert-column",
  "insert-column-right",
  'delete-row',
  'delete-column',
  // "delete-cell",
  'hide-row',
  'hide-column',
  'set-row-height',
  'set-column-width',
  '|',
  'conditionFormat',
  'filter',
  // 'searchReplace',
  'dataVerification',
  'ascSort',
  'desSort',
  '|',
  // 'chart',
  // 'image',
  // 'link',
  'data',
  'cell-format',
  // 'comment',
  'split-text',
  'freeze-row',
  'freeze-column',
  '|',
  'clear-format',
];

export const CELL_COMMENT_DEFAULT_VALUE = {
  height: null,
  isShow: false,
  left: null,
  top: null,
  value: '',
  width: null,
};
