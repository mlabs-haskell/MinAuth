import * as cmd from 'cmd-ts';
import cli from './cli';

cmd.run(cli, process.argv.slice(2));
