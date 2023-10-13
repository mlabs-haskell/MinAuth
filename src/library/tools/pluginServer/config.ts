import { z } from 'zod';
import * as PL from '@lib/plugin/fp/pluginLoader';
import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { Field, Poseidon } from 'o1js';

export const configurationSchema = PL.configurationSchema.extend({
  address: z.string().default('127.0.0.1'),
  port: z.number().default(3001)
});

export type Configuration = z.infer<typeof configurationSchema>;

const mkPluginDir = (name: string) =>
  `${__dirname}/../../../plugins/${name}/server`;

export const defaultConfiguration: Configuration = configurationSchema.parse({
  plugins: {
    SimplePreimagePlugin: {
      path: mkPluginDir('simplePreimage'),
      config: {
        roles: {
          '7555220006856562833147743033256142154591945963958408607501861037584894828141':
            'admin',
          '21684304481040958849270710845151658168046794458221536315647897641876555971838':
            'member'
        }
      }
    },
    MerkleMembershipsPlugin: {
      path: mkPluginDir('merkleMemberships'),
      config: {
        trees: [
          {
            offchainStoragePath: './.fixtures/tree1.json',
            initialLeaves: (() => {
              const r: Record<string, string> = {};

              for (let i = 0; i < 100; i++)
                r[i.toString()] = Poseidon.hash([Field.from(i)]).toString();

              return r;
            })()
          },
          {
            offchainStoragePath: './.fixtures/tree2.json',
            initialLeaves: (() => {
              const r: Record<string, string> = {};

              for (let i = 1; i < 100; i *= 2)
                r[i.toString()] = Poseidon.hash([Field.from(i)]).toString();

              return r;
            })()
          }
        ]
      }
    }
  }
});

export const readConfigurationFallback = pipe(
  PL._readConfiguration<Configuration>(configurationSchema.safeParse)(),
  TE.orElse((error) => {
    console.warn(`unable to read configuration: ${error}, use default`);
    return TE.right(defaultConfiguration);
  }),
  TE.tap((cfg) => TE.fromIO(() => console.info('configuration', cfg)))
);
