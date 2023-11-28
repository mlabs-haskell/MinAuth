import React, { useState, useEffect, useRef } from 'react';
import { TypedWorker, WorkerStatus } from './typedworker';

export interface WorkerComponentProps<WorkerInput, WorkerOutput> {
  mkWorker: () => TypedWorker<WorkerInput, WorkerOutput>;
  workerInput: WorkerInput;
  onWorkerStateChange?: (state: WorkerState) => void;
}

export interface WorkerState {
  status: 'idle' | 'processing' | 'success' | 'error';
  result?: string;
  error?: string;
}
export const WorkerComponent = <WorkerInput, WorkerOutput>({
  mkWorker,
  workerInput,
  onWorkerStateChange
}: WorkerComponentProps<WorkerInput, WorkerOutput>) => {
  const [workerState, setWorkerState] = useState<WorkerState>({
    status: 'idle'
  });
  const workerInitialized = useRef(false);

  useEffect(() => {
    const { worker, setOnMessage, workerPostMessage } = mkWorker();
    console.log('wtf', typeof workerPostMessage);

    // Start the worker immediately with the provided proverType
    if (!workerInitialized.current) {
      // start the work
      console.log('posting worker input', workerInput);
      workerPostMessage(workerInput);
      workerInitialized.current = true;
    }

    setOnMessage((event: MessageEvent<WorkerStatus<WorkerOutput>>) => {
      console.log('Message received from worker', event.data);
      const { status, result, error } = event.data;

      if (status === 'success') {
        setWorkerStateAndUpdateParent({
          status,
          result: JSON.stringify(result)
        });
      } else if (status === 'error') {
        setWorkerStateAndUpdateParent({ status, error: error?.message });
      } else if (status === 'processing') {
        setWorkerStateAndUpdateParent({ status });
      }
    });

    return () => {
      worker.terminate();
    };
  }, []); // Dependency array includes proverType to re-run effect if it changes
  // Function to update component state and notify parent
  const setWorkerStateAndUpdateParent = (newState: WorkerState) => {
    setWorkerState(newState);
    onWorkerStateChange?.(newState);
  };
  const jebieto = JSON.stringify(workerState);

  return (
    <div>
      {workerState.status === 'idle' && <p>Idle...</p>}
      {workerState.status === 'processing' && <p>Processing...</p>}
      {workerState.status === 'success' && <p>Result: {workerState.result}</p>}
      {workerState.status === 'error' && <p>Error: {workerState.error}</p>}
      <p>{jebieto}</p>
    </div>
  );
};

export default WorkerComponent;
