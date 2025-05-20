import { Cell } from '@fileverse-dev/fortune-core';
import { WorkbookInstance } from '@fileverse-dev/fortune-react';
// import { SERVICE_API_KEY } from "@fileverse-dev/formulajs"

// /**
//  * Updates the UI with formula response data by setting cell values in the spreadsheet
//  *
//  * @param r - The starting row index
//  * @param c - The starting column index
//  * @param newV - The new cell value object
//  * @param apiData - Array of data records to display in the spreadsheet
//  * @param sheetEditorRef - Reference to the workbook instance
//  * @returns {void}
//  */
export type FormulaSyncType = {
  row: number;
  column: number;
  newValue: Record<string, string>;
  apiData: Array<Record<string, object>>;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
}
export const formulaResponseUiSync = (
  { row, column, newValue, apiData, sheetEditorRef }: FormulaSyncType
): void => {
  const headers: string[] = Object.keys(apiData[0]);
  // handle row and col ofbound and add new row and col
  const sheet = sheetEditorRef.current?.getSheet();
  const currentTotalRow = sheet?.data?.length || 0;
  const currentTotalColumn = sheet?.data?.[0]?.length || 0;
  const extraRow = apiData.length - (currentTotalRow - row) + 1;
  const extraCol = headers.length - (currentTotalColumn - column) + 1;

  if (extraRow > 0) {
    sheetEditorRef.current?.insertRowOrColumn('row', currentTotalRow - 1, extraRow);
  }
  if (extraCol > 0) {
    sheetEditorRef.current?.insertRowOrColumn('column', currentTotalColumn - 1, extraCol);
  }

  const range = {
    row: [row, row + apiData.length],
    column: [column, column + (headers.length - 1)],
  };

  const data = [];

  // set header
  const headerData: Array<Record<string, string> | string> = [];
  headers.forEach((header, index) => {
    if (index === 0) {
      headerData.push({ ...newValue, m: header, v: header });
    } else {
      headerData.push(header);
    }
  });
  data.push(headerData);

  // set data
  for (let i = 0; i < apiData.length; i++) {
    const tempData: { ct: { fa: string; t: string }; m?: object; v: object }[] =
      [];
    headers.forEach((header) => {
      const cellValue = apiData[i][header];
      tempData.push({
        ct: { fa: '@', t: 's' },
        v: cellValue,
      });
    });
    data.push(tempData);
  }
  sheetEditorRef.current?.setCellValuesByRange(data, range);
};

/**
 * Handles logic after a cell is updated, including processing formula results
 *
 * @param row - The row index of the updated cell
 * @param column - The column index of the updated cell
 * @param oldValue - The previous value of the cell
 * @param newValue - The new value of the cell
 * @param sheetEditorRef - Reference to the workbook instance
 * @param setOpenApiKeyModal - Function to set the API key modal open state
 * @param openApiKeyModalRef - Ref object tracking if the API key modal is open
 * @param contextApiKeyName - Ref object for the current API key name context
 * @returns {Promise<void>}
 */
export const afterUpdateCell = async ({
  row,
  column,
  newValue,
  sheetEditorRef,
  onboardingComplete,
  onboardingHandler,
  dataBlockApiKeyHandler
}: {
  row: number;
  column: number;
  newValue: Cell;
  sheetEditorRef: React.RefObject<WorkbookInstance | null>;
  onboardingComplete: boolean | undefined;
  onboardingHandler: Function | undefined;
  dataBlockApiKeyHandler: Function | undefined;
}): Promise<void> => {
  if (!newValue || (newValue?.v && !newValue.v)) {
    return;
  }

  if (typeof newValue.v === 'string' && newValue.v !== '#NAME?') {
    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      tb: '1',
    });
  }
  if (!onboardingComplete && onboardingHandler) {
    const { row: rowMod, column: colMod } = onboardingHandler({
      row,
      column,
      sheetEditorRef,
    });
    console.log('klklkl', rowMod, colMod);
    row = rowMod;
    column = colMod;
  }

  if (newValue.m === '[object Promise]') {
    // Cell.v type needs to include promise as well
    const promise = newValue.v as unknown as Promise<
      Record<string, string>[] | string
    >;

    promise.then(async (data: Record<string, string>[] | string) => {
      if (typeof data === 'string' && data.includes('Error')) {
        sheetEditorRef.current?.setCellValue(row, column, {
          ...newValue,
          m: data,
        });
        return;
      }

      if (typeof data === 'string' && data.includes('MISSING') && dataBlockApiKeyHandler) {
        dataBlockApiKeyHandler({ data, sheetEditorRef, executeStringFunction, row, column, newValue, formulaResponseUiSync })
      }

      if (Array.isArray(data)) {
        formulaResponseUiSync({
          row,
          column,
          newValue: newValue as Record<string, string>,
          // @ts-expect-error later
          apiData: data as Record<string, object>[],
          sheetEditorRef,
        });
      } else {
        sheetEditorRef.current?.setCellValue(row, column, {
          ...newValue,
          m: data,
        });
      }
    });

    sheetEditorRef.current?.setCellValue(row, column, {
      ...newValue,
      m: 'Fetching...',
    });
  }
};

/**
 * Dynamically executes a function from a string representation
 *
 * @param functionCallString - String representation of the function call
 * @returns {Promise<unknown>} - Result of the function execution
 */
export async function executeStringFunction(
  functionCallString: string,
): Promise<unknown> {
  try {
    // Dynamically import the module
    const module = await import('@fileverse-dev/formulajs');

    // Extract function name and full argument string
    const functionMatch = functionCallString.match(/^(\w+)\((.*)\)$/);
    if (!functionMatch) {
      throw new Error(`Invalid function call format: ${functionCallString}`);
    }

    const functionName = functionMatch[1].toUpperCase(); // "test"
    const argsString = functionMatch[2]; // The entire argument string

    // Parse the arguments, respecting nested structures
    const args = parseArguments(argsString);

    // Check if the function exists in the imported module
    // @ts-expect-error later
    if (typeof module[functionName] === 'function') {
      // Call the function with the parsed arguments
      // @ts-expect-error later
      const result = await module[functionName](...args);
      return result;
    } else {
      throw new Error(`Function ${functionName} not found in module`);
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Parses a complex argument string into an array of properly typed arguments
 *
 * @param argsString - String containing function arguments
 * @returns {any[]} - Array of parsed arguments with appropriate types
 */
function parseArguments(
  argsString: string,
): (string | number | boolean | object | [] | null | undefined)[] {
  if (!argsString.trim()) {
    return []; // No arguments
  }

  const args: (string | number | boolean | object | [] | null | undefined)[] =
    [];
  let currentArg = '';
  let inString = false;
  let stringChar = '';
  let parenCount = 0;
  let bracketCount = 0;
  let braceCount = 0;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    // Handle string literals
    if (
      (char === '"' || char === "'") &&
      (i === 0 || argsString[i - 1] !== '\\')
    ) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      currentArg += char;
      continue;
    }

    // Track nested structures
    if (!inString) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // If comma outside a string or nested structure, it's an argument separator
    if (
      char === ',' &&
      !inString &&
      parenCount === 0 &&
      bracketCount === 0 &&
      braceCount === 0
    ) {
      args.push(evaluateArg(currentArg.trim()));
      currentArg = '';
    } else {
      currentArg += char;
    }
  }

  // Add the last argument
  if (currentArg.trim()) {
    args.push(evaluateArg(currentArg.trim()));
  }

  return args;
}

/**
 * Evaluates a string argument to convert it to the appropriate JavaScript type
 *
 * @param arg - String representation of an argument
 * @returns {any} - Argument converted to its appropriate JavaScript type
 */
function evaluateArg(
  arg: string,
): number | null | undefined | string | object | boolean | [] {
  // Simple numeric check
  if (!isNaN(Number(arg)) && arg.trim() !== '') {
    return Number(arg);
  }

  // Boolean values
  if (arg === 'true') return true;
  if (arg === 'false') return false;

  // Null and undefined
  if (arg === 'null') return null;
  if (arg === 'undefined') return undefined;

  // Array
  if (arg.startsWith('[') && arg.endsWith(']')) {
    try {
      return JSON.parse(arg);
    } catch (e) {
      // If JSON.parse fails, return the raw string
      return arg;
    }
  }

  // Object
  if (arg.startsWith('{') && arg.endsWith('}')) {
    try {
      return JSON.parse(arg);
    } catch (e) {
      return arg;
    }
  }

  // String (remove outer quotes if present)
  if (
    (arg.startsWith('"') && arg.endsWith('"')) ||
    (arg.startsWith("'") && arg.endsWith("'"))
  ) {
    return arg.substring(1, arg.length - 1);
  }

  // Default: return as-is
  return arg;
}
