'use client';
import { TypedWorker } from '@/app/typedworker';
import WorkerComponent, { WorkerState } from '@/app/workercomponent';
import {
  ProverCompilationResult,
  ProverZkCircuit,
  mkProverCompilerWorker
} from '@/workers/provercompilertypes';
import { useState } from 'react';

const mkWorker: () => TypedWorker<
  ProverZkCircuit,
  ProverCompilationResult
> = () => {
  return mkProverCompilerWorker();
};

const workerInput: ProverZkCircuit = { type: 'SimplePreimage' };

const SimplePreimage: React.FC = () => {
  const [proverCompilationState, setProverCompilationState] =
    useState<WorkerState>({
      status: 'idle'
    });

  function onProverCompilationStateChange(state: WorkerState): void {
    setProverCompilationState(state);
  }

  function verificationKey(): string | undefined {
    return proverCompilationState.result;
  }

  /* const schema: RJSFSchema = {
   *   title: 'A simple form',
   *   type: 'object',
   *   required: ['firstName', 'lastName'],
   *   properties: {
   *     firstName: {
   *       type: 'string',
   *       title: 'First name'
   *     },
   *     lastName: {
   *       type: 'string',
   *       title: 'Last name'
   *     }
   *   }
   * }; */

  /* const uiSchema: UiSchema = {
    *   firstName: {
    *     'ui:autofocus': true
    *   },
    *   lastName: {
    *     'ui:autofocus': true
    *   }
    * };

    * const onSubmit = ({ formData }) => {
    *   console.log('Data submitted:', formData);
    * }; */

  return (
    <div>
      <p>Hello World! </p>
      <WorkerComponent
        mkWorker={mkWorker}
        workerInput={workerInput}
        onWorkerStateChange={onProverCompilationStateChange}
      />
      <p>{verificationKey() ? <div> verificationKey() </div> : <></>} </p>
    </div>
  );
};

export default SimplePreimage;
