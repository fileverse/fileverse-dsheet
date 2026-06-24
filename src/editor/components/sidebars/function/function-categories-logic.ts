import type { SpreadsheetFunction } from './types';

export const PARSER_FUNCTIONS = new Set([
  'CONVERT',
  'TO_DATE',
  'TO_DOLLARS',
  'TO_PERCENT',
  'TO_PURE_NUMBER',
  'TO_TEXT',
]);

export const TYPE_TO_CATEGORY_KEY: Record<number, string> = {
  0: 'Math',
  1: 'Statistical',
  2: 'Lookup',
  6: 'Date',
  8: 'Financial',
  9: 'Engineering',
  10: 'Logical',
  11: 'Operator',
  12: 'Text',
  13: 'Engineering',
  14: 'Array',
  15: 'Info',
  16: 'Operator',
  17: 'Database',
  20: 'Datablock',
};

export const CATEGORY_ORDER = [
  'All',
  'Datablock',
  'Array',
  'Database',
  'Date',
  'Engineering',
  'Financial',
  'Info',
  'Logical',
  'Lookup',
  'Math',
  'Operator',
  'Parser',
  'Statistical',
  'Text',
  'Other',
] as const;

export type CategoryKey = (typeof CATEGORY_ORDER)[number];

export function getFunctionCategoryKey(
  fnName: string,
  typeId: number
): CategoryKey {
  const name = String(fnName || '')
    .trim()
    .toUpperCase();

  if (name && PARSER_FUNCTIONS.has(name)) return 'Parser';

  const mapped = TYPE_TO_CATEGORY_KEY[Number(typeId)];
  return (mapped || 'Other') as CategoryKey;
}

export function groupFunctionsByCategory(functionlist: SpreadsheetFunction[]) {
  const byCategory = new Map<CategoryKey, SpreadsheetFunction[]>();

  const add = (key: CategoryKey, fn: SpreadsheetFunction) => {
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(fn);
  };

  for (const fn of functionlist || []) {
    const name = String(fn?.n || '').trim();
    if (!name) continue;
    const key = getFunctionCategoryKey(name, Number(fn?.t));
    add(key, fn);
  }

  // Synthetic "All" category.
  const all = (functionlist || [])
    .filter((fn) => String(fn?.n || '').trim())
    .slice()
    .sort((a, b) =>
      String(a?.n || '').localeCompare(String(b?.n || ''), undefined, {
        sensitivity: 'base',
      })
    );
  byCategory.set('All', all);

  // Sort each category list by function name.
  byCategory.forEach((list: SpreadsheetFunction[], key: CategoryKey) => {
    if (key === 'All') return;
    list.sort((a: SpreadsheetFunction, b: SpreadsheetFunction) =>
      String(a?.n || '').localeCompare(String(b?.n || ''), undefined, {
        sensitivity: 'base',
      })
    );
  });

  const categories = CATEGORY_ORDER.filter(
    (k) => k === 'All' || (byCategory.get(k)?.length ?? 0) > 0
  );

  return { categories, byCategory };
}
