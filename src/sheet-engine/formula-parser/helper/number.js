/**
 * Entire string must be a decimal number (Sheets-like; rejects "2a", "1x", etc.).
 * Allows optional sign, exponent.
 */
const STRICT_DECIMAL_STRING =
  /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Convert value into number for arithmetic (+ - * / ^, unary +/-, numeric literals).
 * Strings that are not strictly numeric (no parseFloat prefix tricks) become NaN.
 *
 * @param {*} number
 * @returns {number|NaN}
 */
export function toNumber(number) {
  if (number == null || number === "") {
    return 0;
  }

  if (typeof number === "number") {
    return Number.isNaN(number) ? NaN : number;
  }

  if (typeof number === "boolean") {
    return number ? 1 : 0;
  }

  if (typeof number === "string") {
    const t = number.trim();
    if (t === "") {
      return 0;
    }
    if (!STRICT_DECIMAL_STRING.test(t)) {
      return NaN;
    }
    const n = Number(t);
    return Number.isNaN(n) ? NaN : n;
  }

  const n = Number(number);
  return Number.isNaN(n) ? NaN : n;
}

/**
 * Invert provided number (unary minus).
 *
 * @param {*} number
 * @returns {number}
 */
export function invertNumber(number) {
  return -1 * toNumber(number);
}
