import * as cmd from 'cmd-ts';

export const commonOptions = {
  serverUrl: cmd.option({
    long: 'server-url',
    short: 's',
    type: cmd.string,
    defaultValue: () => 'http://127.0.0.1:3000'
  }),
  jwtFile: cmd.option({
    long: 'jwt-file',
    short: 'j',
    type: cmd.string,
    defaultValue: () => './.fixtures/jwt'
  }),
  refreshTokenFile: cmd.option({
    long: 'refresh-token-file',
    short: 's',
    type: cmd.string,
    defaultValue: () => './.fixtures/refreshToken'
  })
};
