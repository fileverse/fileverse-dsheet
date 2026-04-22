export const ERROR = "ERROR";
export const ERROR_DIV_ZERO = "DIV/0";
export const ERROR_NAME = "NAME";
export const ERROR_NOT_AVAILABLE = "N/A";
export const ERROR_NULL = "NULL";
export const ERROR_NUM = "NUM";
export const ERROR_REF = "REF";
export const ERROR_VALUE = "VALUE";
export const CIRCULAR_REF_ERROR = "CIRC";

const errors = {
  ['Error: lookup_range and result_range are required']: "Lookup range and result range are required",
  [ERROR]: "Syntax error",
  [ERROR_DIV_ZERO]: "#DIV/0!",
  [ERROR_NAME]: "Wrong function name or parameter",
  [ERROR_NOT_AVAILABLE]: "#N/A",
  [ERROR_NULL]: "#NULL!",
  [ERROR_NUM]: "#NUM!",
  [ERROR_REF]: "#REF!",
  [ERROR_VALUE]: "#VALUE!",
  [CIRCULAR_REF_ERROR]: "#CIRC!",
  ['search_key']: "Error: search_key is required",
  ['lookup_range']: "Error: lookup_range is required",
  ['result_range']: "Error: result_range is required",
  ['lookup_range_single']: "Error: lookup_range must be a singular row or column",
  ['result_range_invalid']: "Error: result_range is invalid",
  ['lookup_range_and_result_range']: "Error: lookup_range and result_range must have the same number of columns",
  ['match_mode_must']: "Error: match_mode must be 0, 1, -1, or 2",
  ['search_mode_must']: "Error: search_mode must be 1, -1, 2, or -2",
  ['binary_search_and_wildcard']: "'Error: Binary search (search_mode ±2) cannot be used with wildcard matching (match_mode 2)",
};

/**
 * Return error type based on provided error id.
 *
 * @param {String} type Error type.
 * @returns {String|null} Returns error id.
 */
export default function error(type) {
  let result;

  type = (type + "").replace(/#|!|\?/g, "");

  if (errors[type]) {
    result = errors[type];
  }

  return result ? result : type;
}

/**
 * Check if error type is strict valid with knows errors.
 *
 * @param {String} Error type.
 * @return {Boolean}
 */
export function isValidStrict(type) {
  let valid = false;

  for (const i in errors) {
    if (Object.prototype.hasOwnProperty.call(errors, i) && errors[i] === type) {
      valid = true;
      break;
    }
  }

  return valid;
}
