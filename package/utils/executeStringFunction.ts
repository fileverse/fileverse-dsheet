/**
 * Dynamically executes a function from a string representation
 *
 * @param functionCallString - String representation of the function call
 * @returns {Promise<unknown>} - Result of the function execution
 */
export const executeStringFunction = async (
  functionCallString: string,
): Promise<unknown> => {
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
