import type {
  WorkerEvalError,
  WorkerEvalRequest,
  WorkerEvalResponse,
} from './formula-worker-types';
import { evalFormulasInSnapshot } from './formula-snapshot-eval';

self.onmessage = (event: MessageEvent<WorkerEvalRequest>) => {
  const msg = event.data;
  if (msg?.type !== 'eval') return;
  try {
    const output = evalFormulasInSnapshot(msg.input);
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
