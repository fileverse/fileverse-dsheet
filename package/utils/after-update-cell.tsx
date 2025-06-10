/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Cell } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
import { OnboardingHandlerType, DataBlockApiKeyHandlerType } from '../types';
import { formulaResponseUiSync } from './formula-ui-sync';

// Constants
const DEFAULT_FONT_SIZE = 10;
const LINE_HEIGHT_MULTIPLIER = 1.5;
const PROMISE_OBJECT_STRING = '[object Promise]';
const LOADING_MESSAGE = 'Loading...';
const FETCH_URL_MODAL_ID = 'fetch-url-modal';
const FLVURL_FUNCTIONS = ['FLVURL', 'flvurl'];

/**
 * Parameters for the afterUpdateCell function
 */
interface AfterUpdateCellParams {
  row: number;
  column: number;
  newValue: Cell;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  onboardingComplete: boolean | undefined;
  setFetchingURLData: (fetching: boolean) => void;
  onboardingHandler: OnboardingHandlerType | undefined;
  dataBlockApiKeyHandler: DataBlockApiKeyHandlerType | undefined;
  setInputFetchURLDataBlock:
  | React.Dispatch<React.SetStateAction<string>>
  | undefined;
  storeApiKey?: (apiKeyName: string) => void;
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

/**
 * Checks if the cell value is a string that needs text block formatting
 */
const shouldApplyTextBlockFormatting = (newValue: Cell): boolean => {
  return (
    typeof newValue.v === 'string' && newValue.v !== '#NAME?' && !newValue?.tb
  );
};

/**
 * Applies text block formatting to a cell
 */
const applyTextBlockFormatting = (
  newValue: Cell,
  sheetEditorRef: React.RefObject<WorkbookInstance | null>,
  row: number,
  column: number,
): void => {
  sheetEditorRef.current?.setCellValue(row, column, {
    ...newValue,
    tb: '1',
  });
};

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
    m: data,
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

/**
 * Processes promise resolution for regular formulas
 */
const processRegularPromise = async (
  promise: Promise<Record<string, string>[] | string>,
  params: Pick<
    AfterUpdateCellParams,
    | 'row'
    | 'column'
    | 'newValue'
    | 'sheetEditorRef'
    | 'dataBlockApiKeyHandler'
    | 'storeApiKey'
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

    if (Array.isArray(data)) {
      // @ts-ignore
      handleArrayResponse(data, params);
    } else {
      handleStringResponse(data as string, params);
    }
    const workbookContext = params.sheetEditorRef.current?.getWorkbookContext();
    const formulaName = params.newValue?.f?.match(/^=([A-Z0-9_]+)\s*\(/)?.[1];
    const apiKeyName =
      workbookContext?.formulaCache.functionlistMap[formulaName || '']?.API_KEY;
    params.storeApiKey?.(apiKeyName);
  } catch (error) {
    console.error('Error processing regular promise:', error);
    handleStringResponse('Error processing data', params);
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
  if (!newValue?.ct?.s?.[0]?.v) {
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

  // Apply text block formatting if needed
  if (shouldApplyTextBlockFormatting(newValue)) {
    applyTextBlockFormatting(
      newValue,
      sheetEditorRef,
      params.row,
      params.column,
    );
  }

  // Adjust row height based on content
  adjustRowHeight({
    newValue,
    sheetEditorRef,
    row: params.row,
  });

  // Handle onboarding if needed
  const { row, column } = handleOnboarding(params);
  const updatedParams = { ...params, row, column };

  // Handle promise-based values
  if (newValue.m === PROMISE_OBJECT_STRING) {
    await handlePromiseValue(newValue, updatedParams);
  }
};
