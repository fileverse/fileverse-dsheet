export function sanitizeValue(value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) {
    return flattenArray(value);
  }
  if (isPlainObject(value)) {
    return [flattenObject(value as Record<string, unknown>)];
  }
  return value;
}

export function flattenArray(arr: unknown[]): unknown[] {
  const result: Record<string | number, unknown> = {};
  let allPlainObjects = true;

  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) continue;
    const item = sanitizeValue(arr[i]);
    const isPlainObject = typeof item === 'object' && item !== null;

    if (!isPlainObject) {
      allPlainObjects = false;
      result[`item_${i}`] = item;
    } else {
      Object.assign(result, item as Record<string, unknown>);
    }
  }

  return allPlainObjects ? arr : [result];
}

export function flattenObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      result[key] = flattenArray(val);
    } else if (isPlainObject(val)) {
      Object.assign(result, flattenObject(val as Record<string, unknown>));
    } else {
      result[key] = sanitizeValue(val);
    }
  }
  return result;
}

export function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    Object.getPrototypeOf(val) === Object.prototype
  );
}
