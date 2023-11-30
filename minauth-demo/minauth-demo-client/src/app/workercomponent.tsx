import React, { useState, useEffect, useRef } from 'react';

export interface WorkComponentProps<WorkInput, WorkOutput> {
  workInput: WorkInput;
  executor: (workInput: WorkInput) => Promise<WorkOutput>;
  onWorkStateChange: (state: WorkState<WorkOutput>) => void;
}

export interface WorkState<WorkOutput> {
  status: 'idle' | 'processing' | 'success' | 'error';
  result?: WorkOutput;
  error?: string;
}
export const WorkComponent = <WorkInput, WorkOutput>({
  workInput,
  executor,
  onWorkStateChange
}: WorkComponentProps<WorkInput, WorkOutput>) => {
  const [workState, setWorkState] = useState<WorkState<WorkOutput>>({
    status: 'idle'
  });
  const workInitialized = useRef(false);

  const wrapExecutor = (
    executor: (workInput: WorkInput) => Promise<WorkOutput>
  ) => {
    return async (workInput: WorkInput) => {
      try {
        setWorkState({ status: 'processing' });
        const result = await executor(workInput);
        const workResult = { status: 'success', result };
        setWorkState(workResult);
        onWorkStateChange(workResult);
      } catch (error) {
        const workResult = { status: 'error', error: JSON.stringify(error) };
        setWorkState(workResult);
        onWorkStateChange(workResult);
      }
    };
  };

  useEffect(() => {
    // Start the work immediately with the provided proverType
    if (!workInitialized.current) {
      // start the work
      console.log('posting work input', workInput);
      wrapExecutor(executor)(workInput).catch((error) => {
        console.log('error in work', error);
      });
    }
  }, []); // Dependency array includes proverType to re-run effect if it changes

  return (
    <div>
      {workState.status === 'idle' && <p>Idle...</p>}
      {workState.status === 'processing' && <p>Processing...</p>}
      {workState.status === 'success' && (
        <p>Result: {JSON.stringify(workState.result)}</p>
      )}
      {workState.status === 'error' && <p>Error: {workState.error}</p>}
    </div>
  );
};

export default WorkComponent;
