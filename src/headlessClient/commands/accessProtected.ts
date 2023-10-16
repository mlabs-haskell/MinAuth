import * as cmd from 'cmd-ts';
import { commonOptions } from './common';
import { Client } from '../client';
import * as fs from 'fs/promises';

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
  const jwtToken: string = await fs.readFile(cfg.jwtFile, 'utf-8');
  const resp = await client.accessProtected(jwtToken, cfg.protectedPath);
  console.log(resp);
};

export const command = cmd.command({
  name: 'accessProtected',
  args,
  handler
});

export default command;
