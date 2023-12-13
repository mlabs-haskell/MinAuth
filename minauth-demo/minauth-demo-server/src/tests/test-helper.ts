import { Option } from 'fp-ts/lib/Option.js';
import { Field, PrivateKey } from 'o1js';
import * as MerkleMembershipsPG from 'minauth-merkle-membership-plugin/proofgenerator.js';
import * as SimplePreimagePG from 'minauth-simple-preimage-plugin/proofgenerator.js';
import {
  ActionEnv,
  fullWorkflowAction
} from '../headless-test-client/actions.js';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import * as O from 'fp-ts/lib/Option.js';
import * as PluginServer from 'minauth/tools/plugin-server/config.js';
import * as cp from 'child_process';
import * as log from 'tslog';
import '@relmify/jest-fp-ts';
import axios from 'axios';

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
        kind: 'simplePreimage';
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
      kind: 'simplePreimage';
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
    `${__dirname}/../plugins/${name}/server`;

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

const testLogger = new log.Logger<log.ILogObj>({ name: `test` });

const startPluginServer = async (
  rawCfg: TestPluginServerConf
): Promise<cp.ChildProcess> => {
  const fixtureDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'minauth-e2e-tests')
  );

  testLogger.debug('fixture dir', fixtureDir);

  const pluginsDir = path.join(fixtureDir, 'plugins');

  await fs.mkdir(pluginsDir);
  const serverConfig = await encodeServerConfig(pluginsDir, rawCfg);

  const serverConfigPath = path.join(fixtureDir, 'config.json');
  await fs.writeFile(serverConfigPath, JSON.stringify(serverConfig), 'utf-8');

  const env = { ...process.env, MINAUTH_CONFIG: serverConfigPath };

  const p = cp.spawn('ts-node', ['src/library/tools/plugin-server'], {
    stdio: 'inherit', // TODO redirect stdout to a file for debugging.
    env
  });

  // Waiting for the plugin server to fully initialize.

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const resp = await axios.get('http://127.0.0.1:3001/health');
      if (resp.status == 200) break;
    } catch (err) {
      /* empty */
    }
  }

  testLogger.debug('plugin server spawned', p.pid);

  return p;
};

const startSomeServer = async (): Promise<cp.ChildProcess> => {
  const p = cp.spawn('ts-node', ['src/someServer'], {
    stdio: 'inherit'
  });

  testLogger.debug('api server spawned', p.pid);

  return p;
};

const mkJestTest = (c: TestCase) =>
  test(c.name, async () => {
    const action =
      c.kind === 'merkleMemberships'
        ? fullWorkflowAction(MerkleMembershipsPG.generator, c.config)
        : fullWorkflowAction(SimplePreimagePG.generator, c.config);

    const actionEnv: ActionEnv = {
      logger: testLogger.getSubLogger({ name: c.name }),
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
      someServerProcess = await startSomeServer();
      pluginServerProcess = await startPluginServer(g.server);
    });

    g.tests.map(mkJestTest);

    afterAll(() => {
      pluginServerProcess.kill();
      someServerProcess.kill();
    });
  });
