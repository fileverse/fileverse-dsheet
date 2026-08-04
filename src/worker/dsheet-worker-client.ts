import * as Comlink from 'comlink';
// Inline worker: the whole worker bundle (exceljs, luckyexcel, pipeline) is
// embedded in the package output and spawned from a blob URL at runtime, so
// consuming apps need no worker asset wiring. Their CSP must allow
// `worker-src blob:` (or the `child-src`/`script-src` fallback).
import DsheetWorkerCtor from './dsheet-worker?worker&inline';
import type { DsheetWorkerApi } from './dsheet-worker';

export type { DsheetWorkerApi };

/** Terminate the worker after this long without an active or new task. */
const WORKER_IDLE_TERMINATE_MS = 30_000;

let active: {
  worker: Worker;
  api: Comlink.Remote<DsheetWorkerApi>;
} | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTaskCount = 0;

export const isDsheetWorkerSupported = (): boolean =>
  typeof window !== 'undefined' && typeof Worker !== 'undefined';

const clearIdleTimer = (): void => {
  if (idleTimer != null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
};

export const terminateDsheetWorker = (): void => {
  clearIdleTimer();
  if (active) {
    active.api[Comlink.releaseProxy]();
    active.worker.terminate();
    active = null;
  }
};

const scheduleIdleTerminate = (): void => {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (pendingTaskCount === 0) terminateDsheetWorker();
  }, WORKER_IDLE_TERMINATE_MS);
};

const ensureWorker = (): Comlink.Remote<DsheetWorkerApi> => {
  if (!active) {
    const worker = new DsheetWorkerCtor();
    active = { worker, api: Comlink.wrap<DsheetWorkerApi>(worker) };
  }
  return active.api;
};

/**
 * Run a task on the shared dsheet worker. The worker is spawned lazily,
 * reused across tasks, and terminated after 30s idle (a parse can hold
 * hundreds of MB of transient allocations — terminating returns them to
 * the OS immediately). Callers must handle rejection and fall back to the
 * main-thread equivalent; a worker that failed is torn down so the next
 * task starts from a fresh one.
 */
export async function runDsheetWorkerTask<T>(
  task: (api: Comlink.Remote<DsheetWorkerApi>) => Promise<T>,
): Promise<T> {
  const api = ensureWorker();
  clearIdleTimer();
  pendingTaskCount += 1;
  try {
    return await task(api);
  } catch (error) {
    terminateDsheetWorker();
    throw error;
  } finally {
    pendingTaskCount -= 1;
    if (pendingTaskCount === 0 && active) scheduleIdleTerminate();
  }
}
