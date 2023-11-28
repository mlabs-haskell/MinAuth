/* eslint-disable @typescript-eslint/no-explicit-any */
export interface WorkerStatus<R> {
  status: 'success' | 'error' | 'processing';
  result?: R;
  error?: {
    message: string;
    error?: unknown;
  };
}

export interface TypedWorker<Input, Output> {
  worker: Worker;
  setOnMessage: (
    onmessage: (ev: MessageEvent<WorkerStatus<Output>>) => any
  ) => void;
  workerPostMessage: (
    message: Input,
    options?: StructuredSerializeOptions
  ) => void;
}

export const mkTypedWorker = <Input, Output>(
  url: URL
): TypedWorker<Input, Output> => {
  const worker = new Worker(url);

  const setOnMessage = (
    onmessage: (ev: MessageEvent<WorkerStatus<Output>>) => any
  ) => {
    worker.onmessage = onmessage;
  };
  console.log('typeof setOnMessage', typeof setOnMessage);

  const workerPostMessage = (
    message: Input,
    options?: StructuredSerializeOptions
  ): void => {
    console.log('posting message to worker', message);
    worker.postMessage(JSON.stringify(message), options);
  };
  return {
    worker,
    setOnMessage,
    workerPostMessage
  };
};

export const mkTypedWorker_workaround = <Input, Output>(
  worker: Worker
): TypedWorker<Input, Output> => {
  const setOnMessage = (
    onmessage: (ev: MessageEvent<WorkerStatus<Output>>) => any
  ) => {
    worker.onmessage = onmessage;
  };
  console.log('typeof setOnMessage', typeof setOnMessage);

  const workerPostMessage = (
    message: Input,
    options?: StructuredSerializeOptions
  ): void => {
    console.log('posting message to worker', message);
    worker.postMessage(JSON.stringify(message), options);
  };
  return {
    worker,
    setOnMessage,
    workerPostMessage
  };
};
