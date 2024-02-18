import * as expressCore from 'express-serve-static-core';
import { IMinAuthPlugin, OutputValidity } from '../plugin/plugintype';
import { InterfaceKind, RetType } from '../plugin/interfacekind';
import { Either } from 'fp-ts/lib/Either';

export type PMap<T> = { [plugin: string]: T };
export type Plugins = PMap<IMinAuthPlugin<InterfaceKind, unknown, unknown>>;

export interface IPluginHost<InterfaceType extends InterfaceKind> {
  verifyProofAndGetOutput(inputs: PMap<unknown>): RetType<InterfaceType, PMap<Either<string, unknown>>>;

  checkOutputValidity(output: PMap<unknown>): RetType<InterfaceType, PMap<OutputValidity>>;

  isReady() : RetType<InterfaceType, boolean>;

  activePluginNames(): RetType<InterfaceType, string[]>;

  // // this ties us into the express app
  // // TODO rethink
  installCustomRoutes(app: expressCore.Express): RetType<InterfaceType, void>;
}

// Assuming the definitions of PMap and Either are as follows:
// export type PMap<T> = { [plugin: string]: T };

// The function to split the map
export function splitPMap<X>(pmap: PMap<Either<string, X>>): { errors: PMap<string>, valid: PMap<X> } {
  const lefts: PMap<string> = {};
  const rights: PMap<X> = {};

  Object.entries(pmap).forEach(([plugin, eitherValue]) => {
    if (eitherValue._tag === 'Left') {
      // It's an error
      lefts[plugin] = eitherValue.left;
    } else if (eitherValue._tag === 'Right') {
      // It's a correct value
      rights[plugin] = eitherValue.right;
    }
  });

  return { errors: lefts, valid: rights };
}
