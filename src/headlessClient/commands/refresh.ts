import * as cmd from 'cmd-ts';
import { Client } from '../client';
import * as fs from 'fs/promises';
import { commonOptions } from './common';

export const args = commonOptions;

export const handler = async (cfg: {
  serverUrl: string;
  refreshTokenFile: string;
  jwtFile: string;
}) => {
  const client = new Client(cfg.serverUrl);
  const refreshToken = await fs.readFile(cfg.refreshTokenFile, 'utf-8');
  const refreshResult = await client.refresh(refreshToken);
  await fs.writeFile(cfg.jwtFile, refreshResult.token);
};

export const command = cmd.command({
  name: 'refresh',
  args,
  handler
});

export default command;
