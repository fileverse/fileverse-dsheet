import type { Context } from '../context';
import type {
  SnapshotEvalInput,
  SnapshotEvalOutput,
  SnapshotFormulaCell,
} from './formula-snapshot-eval';
import { evalFormulasInSnapshot } from './formula-snapshot-eval';
import type { WorkerEvalResponse } from './formula-worker-types';
import { FORMULA_WORKER_CHUNK_SIZE } from './formula-async-eval';

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
  }
>();

function canUseFormulaWorker(): boolean {
  return (
    !workerInitFailed &&
    typeof Worker !== 'undefined' &&
    typeof window !== 'undefined'
  );
}

function getWorker(): Worker | null {
  if (!canUseFormulaWorker()) return null;
  if (worker) return worker;
  try {
    worker = new InlineFormulaWorker();
    worker.onmessage = (
      event: MessageEvent<
        WorkerEvalResponse | { type: 'eval-error'; requestId: number; message: string }
      >,
    ) => {
      const msg = event.data;
      const entry = pending.get(msg.requestId);
      if (!entry) return;
      pending.delete(msg.requestId);
      if (msg.type === 'eval-result') {
        entry.resolve(msg.output);
      } else {
        entry.reject(new Error(msg.message));
      }
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      workerInitFailed = true;
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
    pending.set(requestId, { resolve, reject });
    w.postMessage({ type: 'eval', requestId, input });
  });
}

/**
 * Evaluate a formula chunk off the critical UI path when possible.
 * Uses an inline Web Worker; falls back to main-thread snapshot eval.
 */
export async function evalFormulasInBackground(
  input: SnapshotEvalInput,
): Promise<SnapshotEvalOutput> {
  try {
    return await evalFormulasInWorkerThread(input);
  } catch {
    return evalFormulasInSnapshot(input);
  }
}

/** @deprecated Use evalFormulasInBackground */
export const evalFormulasInWorker = evalFormulasInBackground;

export { FORMULA_WORKER_CHUNK_SIZE };
