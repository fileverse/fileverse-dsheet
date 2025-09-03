import { WorkbookInstance } from '@fileverse-dev/fortune-react';
/**
 * Dynamically executes a function from a string representation
 *
 * @param functionCallString - String representation of the function call
 * @returns {Promise<unknown>} - Result of the function execution
 */
export const executeStringFunction = async (
  functionCallString: string,
  sheetEditorRef?: React.RefObject<WorkbookInstance | null>,
): Promise<unknown> => {
  try {
    // Dynamically import the module
    const module = await import('@fileverse-dev/formulajs');

    // Extract function name and full argument string
    const functionMatch = functionCallString?.match(/^(\w+)\((.*)\)$/);
    if (!functionMatch) {
      throw new Error(`Invalid function call format: ${functionCallString}`);
    }

    const functionName = functionMatch[1].toUpperCase(); // "test"
    const argsString = functionMatch[2]; // The entire argument string

    // Parse the arguments, respecting nested structures
    const ar = parseArguments(argsString);

    //@ts-expect-error later
    const args = ar.map((arg: string) => {
      if (isCellRangeReference(arg)) {
        const cells = cellRangeToRowCol(arg);
        const values = cells?.map((cell) => {
          return sheetEditorRef?.current?.getCellValue(cell?.row, cell?.column);
        });
        return values;
      }
      if (isCellReference(arg)) {
        const cell = cellReferenceToRowCol(arg);

        const value = sheetEditorRef?.current?.getCellValue(
          // @ts-expect-error
          cell?.row,
          cell?.column,
        );
        return value;
      }
      return arg;
    });

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
};

/**
 * Parses a complex argument string into an array of properly typed arguments
 *
 * @param argsString - String containing function arguments
 * @returns {any[]} - Array of parsed arguments with appropriate types
 */
export function parseArguments(
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

/**
 * Checks if a string is a valid cell reference (e.g., A1, B2, AA10, etc.)
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a valid cell reference, false otherwise
 */
export function isCellReference(str: string) {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // Regex pattern: starts with one or more capital letters, followed by one or more digits
  const cellReferencePattern = /^[A-Z]+\d+$/;
  return cellReferencePattern.test(str);
}

/**
 * Checks if a string is a valid cell range reference (e.g., A1:B2, A1:A10, etc.)
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a valid cell range reference, false otherwise
 */
export function isCellRangeReference(str: string) {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // Check if it contains a colon
  if (!str.includes(':')) {
    return false;
  }

  // Split by colon and check if both parts are valid cell references
  const parts = str.split(':');
  if (parts.length !== 2) {
    return false;
  }

  return isCellReference(parts[0]) && isCellReference(parts[1]);
}

/**
 * Converts a cell reference (e.g., A1, B2, AA10) to row and column numbers
 * @param {string} cellRef - The cell reference string (e.g., "A1", "B2")
 * @returns {Object|null} - Object with row and column properties, or null if invalid
 */
export function cellReferenceToRowCol(cellRef: string) {
  if (!isCellReference(cellRef)) {
    return null;
  }

  // Split the string into letters and numbers
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return null;
  }

  const columnStr = match[1];
  const rowStr = match[2];

  // Convert column letters to column number (0-based)
  let column = 0;
  for (let i = 0; i < columnStr.length; i++) {
    const charCode = columnStr.charCodeAt(i) - 65; // A=0, B=1, etc.
    column = column * 26 + charCode;
  }

  // Convert row string to row number (0-based)
  const row = parseInt(rowStr, 10) - 1; // 1-based to 0-based

  return {
    row: row,
    column: column,
  };
}

/**
 * Converts a cell range reference (e.g., A1:B2) to an array of all cells in the range
 * @param {string} rangeRef - The range reference string (e.g., "A1:B2", "A4:B4")
 * @returns {Array|null} - Array of objects with row and column properties, or null if invalid
 */
export function cellRangeToRowCol(rangeRef: string) {
  if (!isCellRangeReference(rangeRef)) {
    return null;
  }

  const parts = rangeRef.split(':');
  const startCell = cellReferenceToRowCol(parts[0]);
  const endCell = cellReferenceToRowCol(parts[1]);

  if (!startCell || !endCell) {
    return null;
  }

  // Determine the actual start and end (in case the range is specified backwards)
  const minRow = Math.min(startCell.row, endCell.row);
  const maxRow = Math.max(startCell.row, endCell.row);
  const minColumn = Math.min(startCell.column, endCell.column);
  const maxColumn = Math.max(startCell.column, endCell.column);

  // Generate array of all cells in the range
  const cells = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      cells.push({ row, column });
    }
  }

  return cells;
}
