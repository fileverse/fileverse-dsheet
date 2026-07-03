import type {
  SnapshotEvalInput,
  SnapshotEvalOutput,
  SnapshotSheet,
} from './formula-snapshot-eval';

export type WorkerInitSnapshotRequest = {
  type: 'init-snapshot';
  snapshotKey: string;
  sheets: SnapshotSheet[];
};

export type WorkerEvalRequest = {
  type: 'eval';
  requestId: number;
  snapshotKey: string;
  input: Omit<SnapshotEvalInput, 'sheets'>;
};

export type WorkerRequest = WorkerInitSnapshotRequest | WorkerEvalRequest;

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
