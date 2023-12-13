import * as cmd from 'cmd-ts';
import login from './commands/login.js';
import refresh from './commands/refresh.js';
import accessProtected from './commands/accessProtected.js';

/**
 * The CLI's top-level command.
 * Install subcommands here.
 */
const topLevelCommand = cmd.subcommands({
  name: 'headlessclient',
  cmds: {
    login,
    refresh,
    accessProtected
  }
});

export default topLevelCommand;
