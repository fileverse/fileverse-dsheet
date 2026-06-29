/** Minimum formula count before deferring eval to chunked async (Step 1). */
export const FORMULA_ASYNC_EVAL_THRESHOLD = 15;

/** Formulas evaluated per animation frame during async recalc. */
export const FORMULA_ASYNC_CHUNK_SIZE = 20;

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
};

export function isFormulaEvalPending(ctx: {
  isFormulaCalculating?: boolean;
  formulaAsyncEval?: FormulaAsyncEvalJob | null;
}): boolean {
  return !!(ctx.isFormulaCalculating && ctx.formulaAsyncEval);
}
