import {
  TypedWorker,
  WorkerStatus,
  mkTypedWorker_workaround
} from '@/app/typedworker';

import Worker from 'worker-loader!./provercompiler.worker';

export interface ProverZkCircuit {
  type: 'SimplePreimage' | 'MerkleMemberships';
}
export interface ProverCompilationResult
  extends WorkerStatus<{ verificationKey: string }> {}

export const mkProverCompilerWorker = (): TypedWorker<
  ProverZkCircuit,
  ProverCompilationResult
> => {
  const worker = new Worker();
  // const worker = new Worker();
  return mkTypedWorker_workaround(worker);
};
