import type { Context } from '../context';
import type {
  SnapshotEvalInput,
  SnapshotEvalOutput,
  SnapshotFormulaCell,
} from './formula-snapshot-eval';
import { evalFormulasInSnapshot } from './formula-snapshot-eval';
import type { WorkerEvalResponse } from './formula-worker-types';
import {
  FORMULA_WORKER_CHUNK_SIZE,
  FORMULA_WORKER_CHUNK_TIMEOUT_MS,
} from './formula-async-eval';

// Inlined at library build time (no separate /assets/*.worker.js for Next.js consumers).
import InlineFormulaWorker from './formula-eval.worker.ts?worker&inline';

let worker: Worker | null = null;
let workerInitFailed = false;
let nextRequestId = 0;
const pending = new Map<
  number,
  {
    resolve: (output: SnapshotEvalOutput) => void;
    reject: (err: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }
>();

function canUseFormulaWorker(): boolean {
  return (
    !workerInitFailed &&
    typeof Worker !== 'undefined' &&
    typeof window !== 'undefined'
  );
}

function rejectAllPending(err: Error): void {
  pending.forEach((entry) => {
    clearTimeout(entry.timeoutId);
    entry.reject(err);
  });
  pending.clear();
}

function disposeWorker(err?: Error): void {
  if (err) rejectAllPending(err);
  worker?.terminate();
  worker = null;
  workerInitFailed = true;
}

function getWorker(): Worker | null {
  if (!canUseFormulaWorker()) return null;
  if (worker) return worker;
  try {
    worker = new InlineFormulaWorker();
    worker.onmessage = (
      event: MessageEvent<
        | WorkerEvalResponse
        | { type: 'eval-error'; requestId: number; message: string }
      >,
    ) => {
      const msg = event.data;
      const entry = pending.get(msg.requestId);
      if (!entry) return;
      pending.delete(msg.requestId);
      clearTimeout(entry.timeoutId);
      if (msg.type === 'eval-result') {
        entry.resolve(msg.output);
      } else {
        entry.reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      disposeWorker(
        new Error(
          event.message ||
            'Formula worker failed before returning a chunk result',
        ),
      );
    };
    worker.onmessageerror = () => {
      disposeWorker(new Error('Formula worker returned an unreadable message'));
    };
    return worker;
  } catch {
    workerInitFailed = true;
    return null;
  }
}

export function buildSnapshotEvalInput(
  ctx: Context,
  formulas: SnapshotFormulaCell[],
): SnapshotEvalInput {
  return {
    sheets: ctx.luckysheetfile.map((sheet) => ({
      id: sheet.id!,
      name: sheet.name ?? '',
      data: sheet.data,
    })),
    execFunctionGlobalData: {
      ...(ctx.formulaCache.execFunctionGlobalData ?? {}),
    },
    formulas,
  };
}

function evalFormulasInWorkerThread(
  input: SnapshotEvalInput,
): Promise<SnapshotEvalOutput> {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error('Formula worker unavailable'));
  }
  const requestId = nextRequestId + 1;
  nextRequestId = requestId;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pending.delete(requestId);
      disposeWorker(new Error('Formula worker chunk timed out'));
      reject(new Error('Formula worker chunk timed out'));
    }, FORMULA_WORKER_CHUNK_TIMEOUT_MS);

    pending.set(requestId, { resolve, reject, timeoutId });
    try {
      w.postMessage({ type: 'eval', requestId, input });
    } catch (e) {
      pending.delete(requestId);
      clearTimeout(timeoutId);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/**
 * Evaluate a formula chunk off the critical UI path when possible.
 * Uses an inline Web Worker. Callers should fall back to the real engine on
 * rejection so the worker cannot silently leave a recalculation job hanging.
 */
export async function evalFormulasInBackground(
  input: SnapshotEvalInput,
): Promise<SnapshotEvalOutput> {
  return evalFormulasInWorkerThread(input);
}

/** @deprecated Use evalFormulasInBackground */
export const evalFormulasInWorker = evalFormulasInBackground;

export { FORMULA_WORKER_CHUNK_SIZE, evalFormulasInSnapshot };
