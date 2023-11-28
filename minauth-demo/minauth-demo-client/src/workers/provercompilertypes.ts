import {
  TypedWorker,
  WorkerStatus,
  mkTypedWorker_workaround
} from '@/app/typedworker';

export interface ProverZkCircuit {
  type: 'SimplePreimage' | 'MerkleMemberships';
}
export interface ProverCompilationResult
  extends WorkerStatus<{ verificationKey: string }> {}

export const mkProverCompilerWorker = (): TypedWorker<
  ProverZkCircuit,
  ProverCompilationResult
> => {
  const worker = new Worker(
    new URL('provercompiler.worker.ts', import.meta.url)
  );
  return mkTypedWorker_workaround(worker);
};
