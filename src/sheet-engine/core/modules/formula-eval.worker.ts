import type {
  WorkerEvalError,
  WorkerRequest,
  WorkerEvalResponse,
} from './formula-worker-types';
import type { SnapshotSheet } from './formula-snapshot-eval';
import { evalFormulasInSnapshot } from './formula-snapshot-eval';

let snapshotKey: string | null = null;
let snapshotSheets: SnapshotSheet[] | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg?.type === 'init-snapshot') {
    snapshotKey = msg.snapshotKey;
    snapshotSheets = msg.sheets;
    return;
  }

  if (msg?.type !== 'eval') return;
  try {
    if (!snapshotSheets || snapshotKey !== msg.snapshotKey) {
      throw new Error('Formula worker snapshot is not initialized');
    }
    const output = evalFormulasInSnapshot({
      sheets: snapshotSheets,
      ...msg.input,
    });
    const response: WorkerEvalResponse = {
      type: 'eval-result',
      requestId: msg.requestId,
      output,
    };
    self.postMessage(response);
  } catch (e) {
    const response: WorkerEvalError = {
      type: 'eval-error',
      requestId: msg.requestId,
      message: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(response);
  }
};
