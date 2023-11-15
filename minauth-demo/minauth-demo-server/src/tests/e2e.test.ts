import * as O from 'fp-ts/Option';
import { Field, Poseidon } from 'o1js';

import { runTestGroup } from './test-helper';

runTestGroup({
  name: 'default',
  server: {
    loadPlugins: {
      SimplePreimagePlugin: {
        kind: 'simplePreimage',
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
        kind: 'merkleMemberships',
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
        password: Field.from('1')
      }
    },
    {
      name: 'bad password',
      outcome: {
        shouldSuccess: false,
        errorSubset: {
          __tag: 'clientError',
          error: {
            __tag: 'badRequest'
          }
        }
      },
      kind: 'simplePreimage',
      config: {
        password: Field.from('424242')
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

// Some thoughts on revoking tests: we have to somehow invalidate the public
// inputs used by the plugin. Conveniently both simple password and merkle
// memberships plugin have their public inputs stored on the server side, so we
// can potentially introduce a plugin custom routes for testing, which allows
// the client to manually invalidate the public input. On the client side,
// the invalidation request needs to be added to the `fullWorkflowAction` action
// defined in `action.ts`.
