/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Cell } from '@fileverse-dev/fortune-react';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import {
  OnboardingHandlerType,
  DataBlockApiKeyHandlerType,
  ErrorMessageHandlerReturnType,
} from '../types';
import { formulaResponseUiSync } from './formula-ui-sync';
import {
  executeStringFunction,
  parseArguments,
  isCellReference,
  isCellRangeReference,
  cellRangeToRowCol,
  cellReferenceToRowCol,
} from './executeStringFunction';
import { dataBlockCalcFunctionHandler } from './dataBlockCalcFunction';
import { ERROR_MESSAGES_FLAG } from '../constants/shared-constants';
import { getSheetIndex, LiveQueryData } from '@fileverse-dev/fortune-core';
import { isHexValue } from './generic';

// Constants
const DEFAULT_FONT_SIZE = 10;
const LINE_HEIGHT_MULTIPLIER = 1.5;
const PROMISE_OBJECT_STRING = '[object Promise]';
const LOADING_MESSAGE = 'Loading...';
const FETCH_URL_MODAL_ID = 'fetch-url-modal';
const FLVURL_FUNCTIONS = ['FLVURL', 'flvurl'];

export type SmartContractResponse = {
  callSignature: unknown[];
};

export type SheetSmartContractApi = {
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  formulaResponseUiSync: Function;
  row: number;
  column: number;
  newValue: Cell;
};

export type SmartContractQueryHandler = (
  sheetApi: SheetSmartContractApi,
) => (callSignature: unknown[]) => Promise<void>;

/**
 * Parameters for the afterUpdateCell function
 */
interface AfterUpdateCellParams {
  row: number;
  column: number;
  oldValue?: Cell;
  newValue: Cell;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  onboardingComplete: boolean | undefined;
  setFetchingURLData: (fetching: boolean) => void;
  onboardingHandler: OnboardingHandlerType | undefined;
  dataBlockApiKeyHandler: DataBlockApiKeyHandlerType | undefined;
  handleSmartContractQuery?: SmartContractQueryHandler | undefined;
  handleLiveQueryData?: (
    subsheetIndex: number,
    queryData: LiveQueryData,
  ) => void;
  setInputFetchURLDataBlock:
    | React.Dispatch<React.SetStateAction<string>>
    | undefined;
  storeApiKey?: (apiKeyName: string) => void;
  onDataBlockApiResponse?: (dataBlockName: string) => void;
  setDataBlockCalcFunction?: React.Dispatch<
    React.SetStateAction<{ [key: string]: { [key: string]: any } }>
  >;
  dataBlockCalcFunction?: { [key: string]: { [key: string]: any } };
}

/**
 * Parameters for the adjustRowHeight function
 */
interface AdjustRowHeightParams {
  newValue: Cell;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  row: number;
}

/**
 * Checks if the cell value is empty or invalid
 */
const isCellValueEmpty = (newValue: Cell): boolean => {
  // @ts-ignore
  return !newValue || (newValue?.v && !newValue.v);
};

type ErrorFlag = (typeof ERROR_MESSAGES_FLAG)[keyof typeof ERROR_MESSAGES_FLAG];

/**
 * Returns true if `msg` contains any of the ERROR_MESSAGES_FLAG values.
 */
function containsErrorFlag(msg: string): boolean {
  const flags = Object.values(ERROR_MESSAGES_FLAG) as ErrorFlag[];
  return (
    (msg && flags.some((flag) => msg.includes(flag))) || msg?.includes('Error')
  );
}

/**
 * Handles onboarding logic and updates row/column if needed
 */
const handleOnboarding = (
  params: Pick<
    AfterUpdateCellParams,
    | 'row'
    | 'column'
    | 'onboardingComplete'
    | 'onboardingHandler'
    | 'sheetEditorRef'
  >,
): { row: number; column: number } => {
  let { row, column } = params;

  if (!params.onboardingComplete && params.onboardingHandler) {
    const result = params.onboardingHandler({
      row,
      column,
      sheetEditorRef: params.sheetEditorRef,
    });
    row = result.row;
    column = result.column;
  }

  return { row, column };
};

/**
 * Checks if the formula contains FLVURL function
 */
const containsFlvurlFunction = (formula: string): boolean => {
  return FLVURL_FUNCTIONS.some((func) => formula.includes(func));
};

/**
 * Extracts URL from FLVURL function
 */
const extractUrlFromFlvurlFunction = (formula: string): string => {
  const lowerCaseMatch = formula.split('flvurl(');
  const upperCaseMatch = formula.split('FLVURL(');

  if (lowerCaseMatch.length > 1) {
    return lowerCaseMatch[1].split(')')[0];
  } else if (upperCaseMatch.length > 1) {
    return upperCaseMatch[1].split(')')[0];
  } else {
    return ''; // or throw an error, depending on your requirements
  }
};

/**
 * Handles error response from promise
 */
const handlePromiseError = (
  data: string,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
  row: number,
  column: number,
  newValue: Cell,
): void => {
  sheetEditorRef.current?.setCellValue(row, column, {
    ...newValue,
    m: data,
    isDataBlockFormula: true,
  });
};

/**
 * Handles array response from promise
 */
const handleArrayResponse = (
  data: Record<string, object>[],
  params: Pick<
    AfterUpdateCellParams,
    'row' | 'column' | 'newValue' | 'sheetEditorRef'
  >,
): void => {
  formulaResponseUiSync({
    row: params.row,
    column: params.column,
    newValue: params.newValue as Record<string, string>,
    apiData: data,
    sheetEditorRef: params.sheetEditorRef,
  });
};

/**
 * Handles string response from promise
 */
const handleStringResponse = (
  data: string,
  params: Pick<
    AfterUpdateCellParams,
    'sheetEditorRef' | 'row' | 'column' | 'newValue'
  >,
): void => {
  params.sheetEditorRef.current?.setCellValue(params.row, params.column, {
    ...params.newValue,
    m: String(data),
    isDataBlockFormula: true,
  });
};

/**
 * Processes promise resolution for FLVURL functions
 */
const processFlvurlPromise = async (
  promise: Promise<Record<string, string>[] | string>,
  params: Pick<
    AfterUpdateCellParams,
    'row' | 'column' | 'newValue' | 'sheetEditorRef' | 'setFetchingURLData'
  >,
): Promise<void> => {
  try {
    const data = await promise;

    if (typeof data === 'string' && data.includes('Error')) {
      handlePromiseError(
        data,
        params.sheetEditorRef,
        params.row,
        params.column,
        params.newValue,
      );
      return;
    }

    const fetchView = document.getElementById(FETCH_URL_MODAL_ID);
    if (Array.isArray(data) && fetchView) {
      // @ts-ignore
      handleArrayResponse(data, params);
    }

    params.setFetchingURLData?.(false);
  } catch (error) {
    console.error('Error processing FLVURL promise:', error);
    params.setFetchingURLData?.(false);
  }
};

const handleDatablockErroMessage = (
  data: ErrorMessageHandlerReturnType,
  dataBlockApiKeyHandler: DataBlockApiKeyHandlerType,
  params: Pick<
    AfterUpdateCellParams,
    'sheetEditorRef' | 'row' | 'column' | 'newValue'
  >,
): void => {
  dataBlockApiKeyHandler({
    data,
    sheetEditorRef: params.sheetEditorRef,
    executeStringFunction,
    row: params.row,
    column: params.column,
    newValue: params.newValue,
    formulaResponseUiSync,
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isDatablockError = (value: any) => {
  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);
  return isObject && containsErrorFlag(value.type);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isSmartContractResponse = (value: any) => {
  const isObject =
    value !== null && typeof value === 'object' && !Array.isArray(value);

  return isObject && value?.responseType === 'smart-contract';
};

/**
 * Processes promise resolution for regular formulas
 */
const processRegularPromise = async (
  promise: Promise<
    unknown[] | ErrorMessageHandlerReturnType | string | SmartContractResponse
  >,
  params: Pick<
    AfterUpdateCellParams,
    | 'row'
    | 'column'
    | 'newValue'
    | 'sheetEditorRef'
    | 'dataBlockApiKeyHandler'
    | 'storeApiKey'
    | 'onDataBlockApiResponse'
    | 'handleSmartContractQuery'
    | 'handleLiveQueryData'
  >,
): Promise<void> => {
  try {
    const data = await promise;
    const formulaName = params.newValue?.f
      ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
      ?.toUpperCase();
    if (isDatablockError(data)) {
      const _data = data as ErrorMessageHandlerReturnType;
      const message =
        _data.message === 'Required'
          ? 'Required parameter was not provided'
          : _data.message;
      params.sheetEditorRef.current?.setCellError(params.row, params.column, {
        title: _data.type,
        message,
      });
      if (!params.dataBlockApiKeyHandler) {
        throw new Error('dataBlockApiKeyHandler missing');
      }

      handleDatablockErroMessage(_data, params.dataBlockApiKeyHandler, params);
      return;
    }

    if (isSmartContractResponse(data)) {
      if (!params.handleSmartContractQuery) {
        throw new Error('Smart contract handler is missing');
      }

      const api: SheetSmartContractApi = {
        sheetEditorRef: params.sheetEditorRef,
        row: params.row,
        column: params.column,
        newValue: params.newValue,
        formulaResponseUiSync,
      };

      const { callSignature } = data as SmartContractResponse;

      const smartContractHandler = params.handleSmartContractQuery(api);
      await smartContractHandler(callSignature);
      return;
    }
    const context = params.sheetEditorRef.current?.getWorkbookContext();

    if (
      context &&
      context.currentSheetId.toString() &&
      params.handleLiveQueryData
    ) {
      const subsheetIndex = getSheetIndex(context, context.currentSheetId);
      if (subsheetIndex?.toString()) {
        const liveQueryData: LiveQueryData = {
          data: {
            row: params.row,
            column: params.column,
            name: formulaName || '',
            value: data as any,
            id: `${params.row}_${params.column}`,
            function: params.newValue.f as string,
            subSheetId: context.currentSheetId,
          },
          cellData: params.newValue,
        };
        params.handleLiveQueryData(subsheetIndex, liveQueryData);
      }
    }

    if (Array.isArray(data)) {
      const firstItem = (data as any[])?.[0];
      if (!data.length || Object.keys(firstItem).length === 0) {
        params.sheetEditorRef.current?.setCellValue(params.row, params.column, {
          ...params.newValue,
          m: 'No Data',
          isDataBlockFormula: true,
        });
      } else {
        // @ts-ignore
        handleArrayResponse(data, params);
      }
    } else if (!data && typeof data !== 'boolean') {
      params.sheetEditorRef.current?.setCellValue(params.row, params.column, {
        ...params.newValue,
        m: 'No Data',
        isDataBlockFormula: true,
      });
    } else {
      handleStringResponse(data as string, params);
    }
    params.onDataBlockApiResponse?.(formulaName as string);
    const workbookContext = params.sheetEditorRef.current?.getWorkbookContext();
    const apiKeyName =
      workbookContext?.formulaCache.functionlistMap[formulaName || '']?.API_KEY;
    params.storeApiKey?.(apiKeyName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (
      error === 'dataBlockApiKeyHandler missing' ||
      error?.message === 'dataBlockApiKeyHandler missing'
    ) {
      throw new Error('dataBlockApiKeyHandler missing');
    } else {
      const formulaName = params.newValue?.f
        ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
        ?.toUpperCase();
      handleDatablockErroMessage(
        {
          type: 'DSHEET_ERROR',
          message: 'Unexpected Error',
          functionName: formulaName,
          reason: error?.message,
        },
        params.dataBlockApiKeyHandler!,
        params,
      );
    }
  }
};

/**
 * Handles promise-based cell values
 */
const handlePromiseValue = async (
  newValue: Cell,
  params: AfterUpdateCellParams,
): Promise<void> => {
  const { row, column, sheetEditorRef } = params;
  const promise = newValue.v as unknown as Promise<
    Record<string, string>[] | string
  >;

  // Check if this is a FLVURL function
  if (newValue.f && containsFlvurlFunction(newValue.f)) {
    const inputURL = extractUrlFromFlvurlFunction(newValue.f);
    params.setInputFetchURLDataBlock?.(inputURL);
    params.setFetchingURLData(true);

    processFlvurlPromise(promise, params);
    sheetEditorRef.current?.setCellValue(row, column, null);
  } else {
    // Regular promise handling
    processRegularPromise(promise, params);

    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      m: LOADING_MESSAGE,
    });
  }
};

/**
 * Calculates the number of line breaks in a string
 */
const countLineBreaks = (text: string): number => {
  return (text.match(/\r?\n/g) || []).length;
};

/**
 * Calculates the required row height based on content
 */
const calculateRowHeight = (
  fontSize: number,
  lineBreakCount: number,
): number => {
  return fontSize * LINE_HEIGHT_MULTIPLIER * (lineBreakCount + 1);
};

/**
 * Adjusts row height based on cell content
 */
const adjustRowHeight = ({
  newValue,
  sheetEditorRef,
  row,
}: AdjustRowHeightParams): void => {
  // Early return if no cell text content
  if (!newValue?.ct?.s?.[0]?.v || newValue?.ct?.s?.[0]?.v === '\r\n') {
    return;
  }

  const valueStr = newValue.ct.s[0].v;
  const fontSize = newValue?.fs || DEFAULT_FONT_SIZE;
  const lineBreakCount = countLineBreaks(valueStr);
  const newHeight = calculateRowHeight(fontSize, lineBreakCount);

  const rowHeightObj = {
    [String(row)]: newHeight,
  };

  const currentRowHeight = sheetEditorRef.current?.getRowHeight([row])?.[row];

  if (currentRowHeight && currentRowHeight < newHeight) {
    sheetEditorRef.current?.setRowHeight(rowHeightObj);
  }
};

/**
 * Handles logic after a cell is updated, including processing formula results
 *
 * @param params - Object containing all required parameters
 * @returns Promise that resolves when processing is complete
 */
export const afterUpdateCell = async (
  params: AfterUpdateCellParams,
): Promise<void> => {
  const { newValue, sheetEditorRef } = params;
  // Early return for empty values
  if (isCellValueEmpty(newValue)) {
    return;
  }

  if (!newValue?.m && !newValue?.v && newValue?.baseValue) {
    sheetEditorRef.current?.setCellValue(params.row, params.column, {
      ...newValue,
      baseValue: undefined,
      ct: { fa: '@', t: 's' },
    });
  }

  // Adjust row height based on content
  adjustRowHeight({
    newValue,
    sheetEditorRef,
    row: params.row,
  });

  if (isHexValue(newValue.v as string)) {
    sheetEditorRef.current?.setCellValue(params.row, params.column, {
      ...newValue,
      m: newValue.v,
      ct: { fa: '@', t: 's' },
    });
  }

  // Handle onboarding if needed
  const { row, column } = handleOnboarding(params);
  const updatedParams = { ...params, row, column };
  const formulaName = newValue.f
    ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
    ?.toUpperCase();
  const currentSheetId = params.sheetEditorRef.current?.getWorkbookContext()
    ?.currentSheetId as string;

  // Handle promise-based values
  if (
    newValue.m === PROMISE_OBJECT_STRING ||
    newValue.m === LOADING_MESSAGE ||
    newValue.m === 'Loading'
  ) {
    await handlePromiseValue(newValue, updatedParams);

    // register dataBlockCalcFunction cell
    updateDataCalcFunc({ params: updatedParams, currentSheetId });
  }

  const dataBlockCalcFunction = params?.dataBlockCalcFunction;
  dataBlockCalcFunctionHandler({
    // @ts-expect-error later
    dataBlockCalcFunction,
    sheetEditorRef,
    currentRow: params.row,
    currentColumn: params.column,
    currentFormulaName: formulaName,
  });
};

// add new entry for new data block refernce
const updateDataCalcFunc = ({
  params,
  currentSheetId,
}: {
  params: AfterUpdateCellParams;
  currentSheetId: string;
}) => {
  //return;
  try {
    params?.setDataBlockCalcFunction?.((dataBlockCalcFunction) => {
      const formulaString = params.newValue?.f?.split('=')[1];

      const functionMatch = formulaString?.match(/^(\w+)\((.*)\)$/);
      if (!functionMatch) {
        throw new Error(`Invalid function call format: ${formulaString}`);
      }

      const argsString = functionMatch[2]; // The entire argument string

      // Parse the arguments, respecting nested structures
      const ar = parseArguments(argsString);

      let args = ar
        //@ts-expect-error later
        .filter((arg: string) => {
          if (isCellRangeReference(arg)) {
            return cellRangeToRowCol(arg);
          }
          if (isCellReference(arg)) {
            return cellReferenceToRowCol(arg);
          }
          return false;
        })
        // @ts-expect-error later
        .map((arg: string) => {
          if (isCellRangeReference(arg)) {
            return cellRangeToRowCol(arg);
          }
          if (isCellReference(arg)) {
            return cellReferenceToRowCol(arg);
          }
          return false;
        });

      args = args.flat();

      // @ts-expect-error later
      const rowRefrenced = args.map((item) => item.row);
      // @ts-expect-error later
      const columnRefrenced = args.map((item) => item.column);
      const formulaName = params.newValue.f
        ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
        ?.toUpperCase();

      const newItem = {
        formulaName,
        row: params.row,
        column: params.column,
        rowRefrenced,
        columnRefrenced,
      };

      // Add new item if it doesn't exist
      return {
        ...dataBlockCalcFunction,
        [currentSheetId]: {
          ...(dataBlockCalcFunction?.[currentSheetId as string] || {}),
          [params.row + '_' + params.column]: newItem,
        },
      };
    });
  } catch (error: any) {
    const formulaName = params.newValue.f
      ?.match(/^=([A-Za-z0-9_]+)\s*\(/)?.[1]
      ?.toUpperCase();
    // send error message to dsheet.new to commit to sentry
    params?.dataBlockApiKeyHandler?.({
      data: {
        message: `ERROR from updateDataCalcFunc ${error?.message}`,
        type: 'Unexpected error',
        functionName: formulaName,
      },
      sheetEditorRef: params.sheetEditorRef,
      executeStringFunction,
      row: params.row,
      column: params.column,
      newValue: params.newValue,
      formulaResponseUiSync,
    });
  }
};
