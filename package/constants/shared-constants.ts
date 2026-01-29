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
    "name": "yoo",
    "config": {},
    "index": "1",
    "status": "0",
    "order": 0,
    "zoomRatio": 1,
    "showGridLines": "1",
    "defaultColWidth": 99,
    "defaultRowHeight": 21,
    "celldata": [
      {
        "r": 0,
        "c": 0,
        "v": {
          "ct": {
            "fa": "General",
            "t": "s"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "a",
          "qp": 1
        }
      },
      {
        "r": 0,
        "c": 1,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "1.0"
        }
      },
      {
        "r": 0,
        "c": 2,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "3.0"
        }
      },
      {
        "r": 1,
        "c": 0,
        "v": {
          "ct": {
            "fa": "General",
            "t": "s"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "b",
          "qp": 1
        }
      },
      {
        "r": 1,
        "c": 1,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "4.0"
        }
      },
      {
        "r": 1,
        "c": 2,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "6.0"
        }
      },
      {
        "r": 2,
        "c": 0,
        "v": {
          "ct": {
            "fa": "General",
            "t": "s"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "c",
          "qp": 1
        }
      },
      {
        "r": 2,
        "c": 1,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "3.0"
        }
      },
      {
        "r": 2,
        "c": 2,
        "v": {
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "2.0"
        }
      },
      {
        "r": 2,
        "c": 4,
        "v": {
          "f": "=VLOOKUP(A2,A1:C3,3)",
          "ct": {
            "fa": "General"
          },
          "fc": "#000000",
          "ff": "Arial",
          "tb": 1,
          "v": "6"
        }
      }
    ],
    "calcChain": [
      {
        "r": 2,
        "c": 4,
        "id": "9cc4fbd7-b940-43b0-8123-207a0241de9d"
      }
    ],
    "id": "9cc4fbd7-b940-43b0-8123-207a0241de9d"
  }
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
