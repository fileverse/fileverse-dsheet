export type RangePassCacheEntry = {
  fragment: any[][];
  cryptoDenomination: string;
  cryptoDecimal: number;
  globalDataKeysFingerprint: string;
};

export function makeRangePassCacheKey(
  sheetId: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): string {
  return `${sheetId}:${startRow}:${endRow}:${startCol}:${endCol}`;
}

export function collectGlobalDataKeysInRange(
  execFunctionGlobalData: Record<string, unknown>,
  sheetId: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
): string {
  const keys: string[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      const key = `${row}_${col}_${sheetId}`;
      if (execFunctionGlobalData[key] != null) {
        keys.push(key);
      }
    }
  }
  keys.sort();
  return keys.join('|');
}

/** Remove the formula origin cell from a full rectangular range fragment. */
export function sliceRangeFragmentForOrigin(
  full: any[][],
  startRow: number,
  startCol: number,
  originRow: number | null | undefined,
  originCol: number | null | undefined,
): any[][] {
  if (originRow == null || originCol == null) {
    return full;
  }
  const result: any[][] = [];
  for (let ri = 0; ri < full.length; ri += 1) {
    const row = startRow + ri;
    const colFragment: any[] = [];
    for (let ci = 0; ci < full[ri].length; ci += 1) {
      const col = startCol + ci;
      if (row === originRow && col === originCol) {
        continue;
      }
      colFragment.push(full[ri][ci]);
    }
    result.push(colFragment);
  }
  return result;
}

type RangeCacheHost = {
  rangeValuePassCache?: Map<string, RangePassCacheEntry>;
  rangeValuePassCacheStats?: { hits: number; misses: number };
};

export function beginRangeValuePassCache(cache: RangeCacheHost): void {
  cache.rangeValuePassCache = new Map();
  cache.rangeValuePassCacheStats = { hits: 0, misses: 0 };
}

export function clearRangeValuePassCache(cache: RangeCacheHost): void {
  cache.rangeValuePassCache = undefined;
  cache.rangeValuePassCacheStats = undefined;
}
