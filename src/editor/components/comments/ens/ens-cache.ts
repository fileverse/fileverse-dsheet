import { getAddressName } from '@fileverse/ens';

export interface EnsStatus {
  name: string;
  isEns: boolean;
}

const STORAGE_KEY = 'dsheet-ens-cache';

let resolutionUrl: string | undefined;
const cache = new Map<string, EnsStatus>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

// Seed from localStorage once.
(() => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, EnsStatus>;
      for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    }
  } catch {
    // ignore corrupt cache
  }
})();

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(cache))
    );
  } catch {
    // ignore quota / serialization errors
  }
};

const notify = () => listeners.forEach((l) => l());

/** Push the host-provided RPC URL into the singleton (called from EditorContent). */
export const setEnsResolutionUrl = (url: string | undefined) => {
  resolutionUrl = url;
};

export const subscribeEns = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getCachedEns = (username: string): EnsStatus | undefined =>
  cache.get(username);

/** Resolve `username` to an EnsStatus, deduped + cached. No-op if already cached/in-flight. */
export const resolveEns = async (username: string): Promise<void> => {
  if (!username || !resolutionUrl) return;
  if (cache.has(username) || inFlight.has(username)) return;
  inFlight.add(username);
  try {
    const { name, isEns, resolved } = await getAddressName(
      username,
      resolutionUrl
    );
    if (resolved) {
      cache.set(username, { name, isEns });
      persist();
    }
  } catch {
    // leave uncached so a transient failure retries next render
  } finally {
    inFlight.delete(username);
    notify();
  }
};
