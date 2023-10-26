import { Option } from 'fp-ts/lib/Option';
import { Field, PrivateKey } from 'o1js';
import * as MerkleMembershipsPG from './proofGenerators/MerkleMembershipsGenerator';
import * as SimplePreimagePG from './proofGenerators/SimplePreimageGenerator';
import { ActionEnv, fullWorkflowAction } from './actions';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import * as O from 'fp-ts/Option';
import * as PluginServer from '@lib/tools/pluginServer/config';
import * as cp from 'child_process';
import * as log from 'tslog';
import '@relmify/jest-fp-ts';

export type PluginKind = 'merkleMemberships' | 'simplePreimage';

export type ChoosePluginConfig<P extends PluginKind> =
  P extends 'merkleMemberships'
    ? {
        feePayer: Option<PrivateKey>;
        trees: {
          tree: Map<number, Field>;
          contract: Option<PrivateKey>;
        }[];
      }
    : P extends 'simplePreimage'
    ? {
        roles: Map<Field, string>;
      }
    : never;

export type ChooseProofGeneratorConfig<P extends PluginKind> =
  P extends 'merkleMemberships'
    ? MerkleMembershipsPG.Conf
    : P extends 'simplePreimage'
    ? SimplePreimagePG.Conf
    : never;

export type TestPluginServerConf = {
  loadPlugins: Record<
    string,
    | {
        kind: 'simplePreImage';
        config: ChoosePluginConfig<'simplePreimage'>;
      }
    | {
        kind: 'merkleMemberships';
        config: ChoosePluginConfig<'merkleMemberships'>;
      }
  >;
};

export type TestOutcome =
  | {
      shouldSuccess: true;
    }
  | {
      shouldSuccess: false;
      errorSubset: unknown;
    };

export type TestCase = { name: string; outcome: TestOutcome } & (
  | {
      kind: 'simplePreImage';
      config: ChooseProofGeneratorConfig<'simplePreimage'>;
    }
  | {
      kind: 'merkleMemberships';
      config: ChooseProofGeneratorConfig<'merkleMemberships'>;
    }
);

export type TestGroup = {
  name: string;
  server: TestPluginServerConf;
  tests: TestCase[];
};

const encodeMerkleMembershipsConfig = async (
  pluginFixtureDir: string,
  rawCfg: ChoosePluginConfig<'merkleMemberships'>
): Promise<unknown> => {
  const trees = await Promise.all(
    rawCfg.trees.map(async ({ tree, contract }, treeIdx) => {
      const treeStorageObj: Record<number, string> = Array.from(
        tree.entries()
      ).reduce((acc: Record<number, string>, [idx, leaf]) => {
        acc[idx] = leaf.toString();
        return acc;
      }, {});
      const treeStoragePath = path.join(
        pluginFixtureDir,
        `tree-${String(treeIdx)}.json`
      );
      await fs.writeFile(treeStoragePath, JSON.stringify(treeStorageObj));
      const treeConfigObj = {
        offchainStoragePath: treeStoragePath,
        contractPrivateKey: O.toUndefined(contract)?.toBase58(),
        initialLeaves: undefined
      };
      return treeConfigObj;
    })
  );
  const feePayerPrivateKey = O.toUndefined(rawCfg.feePayer)?.toBase58();
  return {
    feePayerPrivateKey,
    trees
  };
};

const encodeSimplePreimageConfig = async (
  pluginFixtureDir: string,
  rawConf: ChoosePluginConfig<'simplePreimage'>
): Promise<unknown> => {
  const rolesStoragePath = path.join(pluginFixtureDir, 'roles.json');
  const rolesStorageObj = Array.from(rawConf.roles.entries()).reduce(
    (acc: Record<string, string>, [k, v]): Record<string, string> => {
      acc[k.toString()] = v;
      return acc;
    },
    {}
  );
  await fs.writeFile(
    rolesStoragePath,
    JSON.stringify(rolesStorageObj),
    'utf-8'
  );
  return { loadRolesFrom: rolesStoragePath };
};

const encodeServerConfig = async (
  fixtureDir: string,
  rawCfg: TestPluginServerConf
): Promise<PluginServer.Configuration> => {
  const mkPluginDir = (name: string) =>
    `${__dirname}/../../plugins/${name}/server`;

  const plugins = await Array.from(Object.entries(rawCfg.loadPlugins)).reduce(
    (
      acc: Promise<
        Record<
          string,
          {
            path: string;
            config: unknown;
          }
        >
      >,
      [name, cfg]
    ) =>
      acc.then(async (r) => {
        const pluginDir = path.join(fixtureDir, name);
        await fs.mkdir(path.join(fixtureDir, name));
        const encodedConfig = await (cfg.kind === 'merkleMemberships'
          ? encodeMerkleMembershipsConfig(pluginDir, cfg.config)
          : encodeSimplePreimageConfig(pluginDir, cfg.config));
        r[name] = {
          path: mkPluginDir(cfg.kind),
          config: encodedConfig
        };
        return r;
      }),
    Promise.resolve({})
  );
  return PluginServer.configurationSchema.parse({ plugins });
};

const startPluginServer = async (
  rawCfg: TestPluginServerConf
): Promise<cp.ChildProcess> => {
  const fixtureDir = os.tmpdir();

  const pluginsDir = path.join(fixtureDir, 'plugins');
  await fs.mkdir(pluginsDir);
  const serverConfig = await encodeServerConfig(pluginsDir, rawCfg);

  const serverConfigPath = path.join(fixtureDir, 'config.json');
  await fs.writeFile(serverConfigPath, JSON.stringify(serverConfig), 'utf-8');

  const env = { ...process.env, MINAUTH_CONFIG: serverConfigPath };

  return cp.spawn(
    // FIXME: not sure if this is gonna work on ci.
    'node -r tsconfig-paths/register dist/src/library/tools/pluginServer/index.js',
    { env }
  );
};

const startSomeServer = async (): Promise<cp.ChildProcess> => {
  return cp.spawn(
    'node -r tsconfig-paths/register dist/src/someServer/apiServer.js'
  );
};

const mkJestTest = (c: TestCase) =>
  test(c.name, async () => {
    const action =
      c.kind === 'merkleMemberships'
        ? fullWorkflowAction(MerkleMembershipsPG.generator, c.config)
        : fullWorkflowAction(SimplePreimagePG.generator, c.config);

    const actionEnv: ActionEnv = {
      logger: new log.Logger<log.ILogObj>({ name: `test-${c.name}` }),
      serverUrl: 'http://127.0.0.1:3000'
    };

    const actionResult = await action(actionEnv)();
    const expectation = expect(actionResult);

    c.outcome.shouldSuccess
      ? expectation.toBeRight()
      : expectation.toSubsetEqualLeft(c.outcome.errorSubset);
  });

export const runTestGroup = (g: TestGroup) =>
  describe(`testGroup: ${g.name}`, () => {
    let pluginServerProcess: cp.ChildProcess;
    let someServerProcess: cp.ChildProcess;

    beforeAll(async () => {
      pluginServerProcess = await startPluginServer(g.server);
      someServerProcess = await startSomeServer();
    });

    g.tests.map(mkJestTest);

    afterAll(async () => {
      pluginServerProcess.kill();
      someServerProcess.kill();

      await new Promise((resolve) => pluginServerProcess.on('exit', resolve));
      await new Promise((resolve) => someServerProcess.on('exit', resolve));
    });
  });
