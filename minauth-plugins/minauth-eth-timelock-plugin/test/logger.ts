import { Logger, ILogObj } from 'tslog';

export const log = new Logger<ILogObj>({ name: 'test-logger' });
