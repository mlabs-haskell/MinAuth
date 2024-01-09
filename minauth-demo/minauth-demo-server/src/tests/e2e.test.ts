import * as O from 'fp-ts/lib/Option.js';
import { Field, Poseidon } from 'o1js';

import { runTestGroup } from './test-helper.js';

runTestGroup({
  name: 'default',
  server: {
    loadPlugins: {
      SimplePreimagePlugin: {
        kind: 'simple-preimage',
        config: {
          roles: ((): Map<Field, string> => {
            const m = new Map<Field, string>();
            const roles: string[] = ['member', 'admin', 'superAdmin'];

            for (let i = 0; i < 100; i++)
              m.set(Poseidon.hash([Field.from(i)]), roles[i % roles.length]);

            return m;
          })()
        }
      },
      MerkleMembershipsPlugin: {
        kind: 'merkle-memberships',
        config: {
          feePayer: O.none,
          trees: [
            {
              tree: ((): Map<number, Field> => {
                const m = new Map();

                for (let i = 0; i < 99; i++)
                  m.set(i, Poseidon.hash([Field.from(i)]));

                return m;
              })(),
              contract: O.none
            },
            {
              tree: ((): Map<number, Field> => {
                const m = new Map();

                for (let i = 1; i < 99; i *= 2)
                  m.set(i, Poseidon.hash([Field.from(i)]));

                return m;
              })(),
              contract: O.none
            }
          ]
        }
      }
    }
  },
  tests: [
    {
      name: 'good password',
      outcome: {
        shouldSuccess: true
      },
      kind: 'simplePreimage',
      config: {
        password: Field.from('1'),
        serverUrl: 'http://localhost:3000',
        pluginName: 'simple-preimage'
      }
    },
    {
      name: 'bad password',
      outcome: {
        shouldSuccess: false,
        errorSubset: {
          __tag: 'clientError',
          error: {
            __tag: 'badCredential',
            respBody: 'Unauthorized'
          }
        }
      },
      kind: 'simplePreimage',
      config: {
        password: Field.from('424242'),
        serverUrl: 'http://localhost:3000',
        pluginName: 'simple-preimage'
      }
    },
    {
      name: 'good memberships',
      outcome: {
        shouldSuccess: true
      },
      kind: 'merkleMemberships',
      config: {
        pluginUrl: 'http://127.0.0.1:3001/plugins/MerkleMembershipsPlugin',
        allInputs: [
          {
            treeRoot: Field.from(
              '23677077440781146505135211739372132754346907641862154489298610120615142915141'
            ),
            leafIndex: BigInt(0),
            secret: Field.from(0)
          },
          {
            treeRoot: Field.from(
              '18899731314113395294456531345036718829118004565425508785092877281253012411124'
            ),
            leafIndex: BigInt(2),
            secret: Field.from(2)
          }
        ]
      }
    }
  ]
});
