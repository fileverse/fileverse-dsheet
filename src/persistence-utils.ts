import { fromUint8Array, toUint8Array } from 'js-base64';
import * as Y from 'yjs';
import { type IndexeddbPersistence, storeState } from 'y-indexeddb';

export const DEFAULT_DSHEET_PERSISTENCE_TIMEOUT_MS = 8_000;

export type DSheetContentStatus =
  | 'available'
  | 'empty'
  | 'missing'
  | 'corrupt'
  | 'timed-out'
  | 'unavailable';

export type DSheetContentSnapshot = {
  dsheetId: string;
  status: DSheetContentStatus;
  encodedState: string | null;
  stateVector: string | null;
  error?: Error;
};

export type DSheetContentReadOptions = {
  timeoutMs?: number;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

export const withDsheetPersistenceTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('dSheet IndexedDB operation timed out')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const unavailableDsheetContentSnapshot = (
  dsheetId: string,
  status: Exclude<DSheetContentStatus, 'available' | 'empty'>,
  error?: unknown,
): DSheetContentSnapshot => ({
  dsheetId,
  status,
  encodedState: null,
  stateVector: null,
  ...(error ? { error: toError(error) } : {}),
});

export const snapshotDsheetDocument = (
  dsheetId: string,
  doc: Y.Doc,
): DSheetContentSnapshot => {
  const state = Y.encodeStateAsUpdate(doc);
  return {
    dsheetId,
    status: state.length <= 2 ? 'empty' : 'available',
    encodedState: fromUint8Array(state),
    stateVector: fromUint8Array(Y.encodeStateVector(doc)),
  };
};

export const flushDsheetContentPersistence = async (
  dsheetId: string,
  doc: Y.Doc | null,
  persistence: IndexeddbPersistence | null,
  options: DSheetContentReadOptions = {},
): Promise<DSheetContentSnapshot> => {
  if (!doc || !persistence) {
    return unavailableDsheetContentSnapshot(
      dsheetId,
      'unavailable',
      new Error('dSheet IndexedDB persistence is not ready'),
    );
  }

  const snapshot = snapshotDsheetDocument(dsheetId, doc);
  try {
    await withDsheetPersistenceTimeout(
      storeState(persistence, false),
      options.timeoutMs ?? DEFAULT_DSHEET_PERSISTENCE_TIMEOUT_MS,
    );
    return snapshot;
  } catch (error) {
    return unavailableDsheetContentSnapshot(
      dsheetId,
      /timed out/i.test(toError(error).message) ? 'timed-out' : 'unavailable',
      error,
    );
  }
};

export const mergeDsheetContentPersistence = async (
  dsheetId: string,
  encodedState: string,
  doc: Y.Doc | null,
  persistence: IndexeddbPersistence | null,
  options: DSheetContentReadOptions = {},
): Promise<DSheetContentSnapshot> => {
  if (!doc || !persistence?.synced) {
    return unavailableDsheetContentSnapshot(
      dsheetId,
      'unavailable',
      new Error('dSheet IndexedDB persistence is not ready'),
    );
  }

  try {
    Y.applyUpdate(doc, toUint8Array(encodedState), 'dsheet-package-ingress');
  } catch (error) {
    return unavailableDsheetContentSnapshot(dsheetId, 'corrupt', error);
  }

  return flushDsheetContentPersistence(dsheetId, doc, persistence, options);
};
