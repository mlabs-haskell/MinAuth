'use client';
import WorkComponent, { WorkState } from '@/app/workercomponent';
import { useState } from 'react';
import { SimplePreimageProver } from 'minauth-simple-preimage-plugin/prover.js';

type ProverZkCircuit = { type: 'SimplePreimage' };
type WorkOutput = { verificationKey: string };

const workInput: ProverZkCircuit = { type: 'SimplePreimage' };

async function executor(workInput: ProverZkCircuit): Promise<WorkOutput> {
  if (workInput.type === 'SimplePreimage') {
    return await SimplePreimageProver.compile();
  } else {
    throw new Error('unknown prover type');
  }
}

const SimplePreimage: React.FC = () => {
  const [proverCompilationState, setProverCompilationState] = useState<
    WorkState<WorkOutput>
  >({
    status: 'idle'
  });

  function onProverCompilationStateChange(
    state: WorkState<{ verificationKey: string }>
  ): void {
    setProverCompilationState(state);
  }

  function verificationKey(): string | undefined {
    return proverCompilationState.result?.verificationKey;
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
      <p>Ponizej komponent</p>
      <WorkComponent
        workInput={workInput}
        executor={executor}
        onWorkStateChange={onProverCompilationStateChange}
      />
      <p>{verificationKey() ? <div> verificationKey() </div> : <></>} </p>
    </div>
  );
};

export default SimplePreimage;
