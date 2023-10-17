import * as login from './login';
import * as refresh from './refresh';
import * as accessProtected from './accessProtected';
import * as cmd from 'cmd-ts';

export const args = {
  ...login.args,
  ...refresh.args,
  ...accessProtected.args
};

export const handler = async (args: {
  serverUrl: string;
  jwtFile: string;
  refreshTokenFile: string;
  proofGeneratorName: string;
  proofGeneratorConfFile: string;
  protectedPath: string;
}) => {
  await login.handler(args);
  await refresh.handler(args);
  await accessProtected.handler(args);
};

export const command = cmd.command({
  name: 'runAll',
  args,
  handler
});

export default command;
