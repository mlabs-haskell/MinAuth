import * as cmd from 'cmd-ts';
import login from './commands/login';
import refresh from './commands/refresh';
import accessProtected from './commands/accessProtected';
import runAll from './commands/runAll';
import genTrees from './commands/genTrees';
import genRoles from './commands/genRoles';

const runUtilCommand = cmd.subcommands({
  name: 'runUtil',
  cmds: { genTrees, genRoles }
});

const topLevelCommand = cmd.subcommands({
  name: 'headlessclient',
  cmds: {
    login,
    refresh,
    accessProtected,
    runAll,
    runUtil: runUtilCommand
  }
});

export default topLevelCommand;
