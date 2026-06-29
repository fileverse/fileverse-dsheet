import type { SnapshotEvalInput, SnapshotEvalOutput } from './formula-snapshot-eval';

export type WorkerEvalRequest = {
  type: 'eval';
  requestId: number;
  input: SnapshotEvalInput;
};

export type WorkerEvalResponse = {
  type: 'eval-result';
  requestId: number;
  output: SnapshotEvalOutput;
};

export type WorkerEvalError = {
  type: 'eval-error';
  requestId: number;
  message: string;
};
