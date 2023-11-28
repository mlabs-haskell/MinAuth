// Generic type for messages sent to the worker
export interface WorkerMessage<T> {
  type: string;
  payload?: T;
}

// Generic type for messages received from the worker
export interface WorkerResponse<T> {
  type: string;
  result: T;
}
