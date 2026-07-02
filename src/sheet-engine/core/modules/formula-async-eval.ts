/** Minimum formula count before deferring eval to chunked async (Step 1). */
export const FORMULA_ASYNC_EVAL_THRESHOLD = 15;

/** Formulas evaluated per animation frame during async recalc. */
export const FORMULA_ASYNC_CHUNK_SIZE = 20;

/** Use a Web Worker when the async job has at least this many formulas. */
export const FORMULA_WORKER_THRESHOLD = 100;

/** Formulas evaluated per worker message (larger — runs off main thread). */
export const FORMULA_WORKER_CHUNK_SIZE = 150;

/** Maximum time to wait for a worker chunk before falling back to the real engine. */
export const FORMULA_WORKER_CHUNK_TIMEOUT_MS = 30_000;

export type FormulaEvalDebugMode = 'worker' | 'main-thread' | 'fallback';

export type FormulaEvalDebug = {
  mode: FormulaEvalDebugMode;
  lastChunkMs: number;
  lastChunkSize: number;
  completedChunks: number;
  fallbackChunks: number;
  workerAvailable: boolean;
  unsafeFormulaCount: number;
  workerFormulaCount: number;
  lastError: string | null;
};

export type FormulaAsyncEvalJob = {
  formulaRunList: Array<{
    r: number;
    c: number;
    id: string;
    calc_funcStr: string;
    level?: number;
  }>;
  calcChainKeys: string[];
  impactedByCircular: string[];
  cycleNodes: string[];
  nextIndex: number;
  total: number;
  debug?: FormulaEvalDebug;
};

export function isFormulaEvalPending(ctx: {
  isFormulaCalculating?: boolean;
  formulaAsyncEval?: FormulaAsyncEvalJob | null;
}): boolean {
  return !!(ctx.isFormulaCalculating && ctx.formulaAsyncEval);
}

const WORKER_UNSAFE_FORMULA_RE =
  /\b(SEQUENCE|FILTER|SORT|SORTBY|UNIQUE|TRANSPOSE|ARRAYFORMULA|INDIRECT|OFFSET|INDEX|SPARKLINE)\s*\(/i;

/**
 * The worker snapshot evaluator intentionally handles only scalar formulas that
 * mirror the main engine well. Dynamic/spill/range-indirection formulas stay on
 * the main thread so `spillSortResult` and special range logic remain authoritative.
 */
export function isFormulaWorkerUnsafe(calcFuncStr: string): boolean {
  return WORKER_UNSAFE_FORMULA_RE.test(calcFuncStr);
}
