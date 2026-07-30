import type { Context } from '../context';

/**
 * Immer draft currently being produced in Workbook setContext.
 * Used so ydoc-side cellFormatRanges mutations can mirror into the same
 * draft (instead of React state, which would be stale/frozen mid-produce).
 */
let activeDraftContext: Context | null = null;

export function setActiveDraftContext(ctx: Context | null): void {
  activeDraftContext = ctx;
}

export function getActiveDraftContext(): Context | null {
  return activeDraftContext;
}
