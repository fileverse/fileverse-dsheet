//@ts-nocheck
import { Sheet } from '@fileverse-dev/fortune-react';

/**
 * Compare two spreadsheets' cell data and images, checking if anything changed
 * @param {Array} oldSheets - Original sheets data
 * @param {Array} newSheets - New sheets data
 * @returns {boolean} - true if any cell data or images changed, false if identical
 */

type DiffChange<T> = {
  from: T;
  to: T;
};

type UpdatedItem<T> = {
  key: string;
  before: T;
  after: T;
  changes: Partial<Record<keyof T, DiffChange<any>>>;
};

type DiffResult<T> = {
  added: T[];
  removed: T[];
  updated: UpdatedItem<T>[];
};


export function diffObjectArrays<T extends Record<string, any>>(
  oldArr: readonly T[],
  newArr: readonly T[],
  getKey?: (item: T) => string
): DiffResult<T> {
  const oldMap = new Map<string, T>();
  const newMap = new Map<string, T>();

  oldArr?.forEach((item, index) => oldMap.set(getKey ? getKey(item) : index, item));
  newArr?.forEach((item, index) => newMap.set(getKey ? getKey(item) : index, item));

  const added: T[] = [];
  const removed: T[] = [];
  const updated: UpdatedItem<T>[] = [];

  // Added + Updated
  for (const [key, newItem] of newMap) {
    const oldItem = oldMap.get(key);

    if (!oldItem) {
      added.push(newItem);
      continue;
    }

    const changes: UpdatedItem<T>["changes"] = {};

    (Object.keys(newItem) as Array<keyof T>).forEach(prop => {
      if (newItem[prop] !== oldItem[prop]) {
        changes[prop] = {
          from: oldItem[prop],
          to: newItem[prop],
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      updated.push({
        key,
        before: oldItem,
        after: newItem,
        changes,
      });
    }
  }

  // Removed
  for (const [key, oldItem] of oldMap) {
    if (!newMap.has(key)) {
      removed.push(oldItem);
    }
  }

  return { added, removed, updated };
}

type DiffChange<T> = {
  from: T;
  to: T;
};

type UpdatedEntry<T> = {
  key: string;
  before: T;
  after: T;
  changes: Partial<Record<keyof T, DiffChange<any>>>;
};

type ObjectDiffResult<T> = {
  added: Record<string, T>;
  removed: Record<string, T>;
  updated: UpdatedEntry<T>[];
};


export function diffObjectMap<T extends Record<string, any>>(
  oldObj: Record<string, T>,
  newObj: Record<string, T>
): ObjectDiffResult<T> {
  const added: Record<string, T> = {};
  const removed: Record<string, T> = {};
  const updated: UpdatedEntry<T>[] = [];

  const oldKeys = new Set(Object.keys(oldObj));
  const newKeys = new Set(Object.keys(newObj));

  // Added + Updated
  for (const key of newKeys) {
    const newVal = newObj[key];
    const oldVal = oldObj[key];

    if (!oldVal) {
      added[key] = newVal;
      continue;
    }

    const changes: UpdatedEntry<T>["changes"] = {};

    (Object.keys(newVal) as Array<keyof T>).forEach(prop => {
      if (newVal[prop] !== oldVal[prop]) {
        changes[prop] = {
          from: oldVal[prop],
          to: newVal[prop],
        };
      }
    });

    if (Object.keys(changes).length > 0) {
      updated.push({
        key,
        before: oldVal,
        after: newVal,
        changes,
      });
    }
  }

  // Removed
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed[key] = oldObj[key];
    }
  }

  return { added, removed, updated };
}


