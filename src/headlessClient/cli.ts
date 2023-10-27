import * as cmd from 'cmd-ts';
import login from './commands/login';
import refresh from './commands/refresh';
import accessProtected from './commands/accessProtected';

const topLevelCommand = cmd.subcommands({
  name: 'headlessclient',
  cmds: {
    login,
    refresh,
    accessProtected
  }
});

export default topLevelCommand;
