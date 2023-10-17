import * as cmd from 'cmd-ts';
import * as fs from 'fs/promises';
import { Field, Poseidon } from 'o1js';

export const command = cmd.command({
  name: 'genRoles',
  args: {
    outputDir: cmd.option({
      long: 'output-dir',
      short: 'o',
      defaultValue: () => './.fixtures'
    })
  },
  handler: async (args) => {
    const path = `${args.outputDir}/roles.json`;
    await fs.writeFile(path, JSON.stringify(roles), 'utf-8');
  }
});

const roles: Record<string, string> = (() => {
  const roles: string[] = ['member', 'admin', 'superAdmin'];
  const ret: Record<string, string> = {};
  for (let i = 0; i < 100; i++)
    ret[Poseidon.hash([Field.from(i)]).toString()] = roles[i % roles.length];
  return ret;
})();

export default command;
