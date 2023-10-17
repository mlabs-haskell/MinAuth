import { PersistentInMemoryStorage } from '@plugins/merkleMemberships/server/treeStorage';
import * as cmd from 'cmd-ts';
import { pipe } from 'fp-ts/function';
import * as fs from 'fs/promises';
import { Field, Poseidon } from 'o1js';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';

export const command = cmd.command({
  name: 'genTrees',
  args: {
    outputDir: cmd.option({
      long: 'output-dir',
      short: 'o',
      defaultValue: () => './.fixtures'
    })
  },
  handler: async (args) => {
    await genTree('tree1', tree1, args.outputDir);
    await genTree('tree2', tree2, args.outputDir);
  }
});

const tree1 = (() => {
  const leaves: Record<string, string> = {};
  for (let i = 0; i < 99; i++)
    leaves[i.toString()] = Poseidon.hash([Field.from(i)]).toString();
  return leaves;
})();

const tree2 = (() => {
  const leaves: Record<string, string> = {};
  for (let i = 1; i < 99; i *= 2)
    leaves[i.toString()] = Poseidon.hash([Field.from(i)]).toString();
  return leaves;
})();

const genTree = async (
  name: string,
  initialLeaves: Record<string, string>,
  outputDir: string
) => {
  const path = `${outputDir}/${name}.json`;
  await fs.rm(path).then(
    () => {},
    (err) => console.warn(`unable to remove ${path}: ${err}`)
  );

  await pipe(
    PersistentInMemoryStorage.initialize(path, initialLeaves),
    TE.tap((s) => s.persist()),
    TE.tap((s) =>
      pipe(
        s.getRoot(),
        TE.tapIO(
          (root) => () => console.log(`root of ${name}: ${root.toString()}`)
        )
      )
    )
  )().then(
    E.match(
      (err) => Promise.reject(`error while generating ${name}: ${err}`),
      () => Promise.resolve(undefined)
    )
  );
};

export default command;
