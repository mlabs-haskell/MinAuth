import * as cmd from 'cmd-ts';
import { commonOptions } from './common';
import { Client } from '../client';

export const args = {
  ...commonOptions,
  protectedPath: cmd.option({
    type: cmd.string,
    long: 'protected path',
    defaultValue: () => '/protected'
  })
};

export const handler = async (cfg: {
  serverUrl: string;
  jwtFile: string;
  protectedPath: string;
}) => {
  const client = new Client(cfg.serverUrl);
  await client.accessProtected(cfg.jwtFile, cfg.protectedPath);
};

export const command = cmd.command({
  name: 'accessProtected',
  args,
  handler
});

export default command;
