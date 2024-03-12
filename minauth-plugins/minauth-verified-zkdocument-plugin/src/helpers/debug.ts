import { Logger, ILogObj } from 'tslog'

export const dbgLog = new Logger<ILogObj>({name: "debug"})

export const dbg = dbgLog.debug

