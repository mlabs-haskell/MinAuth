import * as cmd from 'cmd-ts';
import cli from './cli.js';

/** Run the CLI */
cmd.run(cli, process.argv.slice(2));
