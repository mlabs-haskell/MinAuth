import * as expressCore from 'express-serve-static-core';
import { IMinAuthPlugin, OutputValidity } from '../plugin/plugintype.js';
import {
  FpInterfaceType,
  InterfaceKind,
  RetType,
  TsInterfaceType,
  WithInterfaceTag
} from '../plugin/interfacekind.js';
import { Either } from 'fp-ts/lib/Either.js';
import { TaskEither } from 'fp-ts/lib/TaskEither.js';
import * as E from 'fp-ts/lib/Either.js';

/**
 * Convenience abbreviation for a maping from plugin names to a generic type `T`.
 */
export type PMap<T> = { [plugin: string]: T };

/**
 * Similarly - represents a map of plugin names to their respective `IMinAuthPlugin` instances.
 */
export type Plugins = PMap<IMinAuthPlugin<InterfaceKind, unknown, unknown>>;

/**
 * Interface for a plugin host which manages hosting and interactions with a set of active plugins.
 */
export interface IPluginHost<InterfaceType extends InterfaceKind>
  extends WithInterfaceTag<InterfaceType> {
  /**
   * Verifies the provided inputs using the authentication plugins and returns their outputs.
   * @param inputs A map of inputs where each key corresponds to a plugin name and its associated input.
   * @returns A map of plugin outputs wrapped in `Either` to distinguish between valid outputs and errors.
   */
  verifyProofAndGetOutput(
    inputs: PMap<unknown>
  ): RetType<InterfaceType, PMap<Either<string, unknown>>>;

  /**
   * Checks the validity of the outputs provided by the authentication plugins.
   * @param output A map of outputs where each key corresponds to a plugin name and its associated output.
   * @returns A map indicating the validity of each plugin's output.
   */
  checkOutputValidity(
    output: PMap<unknown>
  ): RetType<InterfaceType, PMap<OutputValidity>>;

  /**
   * Determines if the plugin host is ready to process requests.
   * @returns A boolean value wrapped in the appropriate return type indicating the readiness of the plugin host.
   */
  isReady(): RetType<InterfaceType, boolean>;

  /**
   * Retrieves the names of active plugins managed by the plugin host.
   * @returns An array of active plugin names wrapped in the appropriate return type.
   */
  activePluginNames(): RetType<InterfaceType, string[]>;

  /**
   * Allows the installation of custom routes specific to the authentication plugins into an Express application.
   * @param app The Express application instance to which the custom routes will be added.
   */
  installCustomRoutes(app: expressCore.Express): RetType<InterfaceType, void>;
}

/**
 * Splits a PMap containing Either values into two separate PMaps for errors and valid values respectively.
 * @param pmap A map of plugin names to Either values representing either errors (Left) or valid values (Right).
 * @returns An object containing two PMaps: one for errors and another for valid values.
 */
export function splitPMap<X>(pmap: PMap<Either<string, X>>): {
  errors: PMap<string>;
  valid: PMap<X>;
} {
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

/**
 * Converts an `IPluginHost` from using the functional programming (FP) interface to the idiomatic TypeScript (TS) interface.
 * @param host The FP interface-based `IPluginHost` instance to be converted.
 * @returns An `IPluginHost` instance that conforms to the TypeScript (TS) interface.
 */
export const fpToTsPluginHost = (
  host: IPluginHost<FpInterfaceType>
): IPluginHost<TsInterfaceType> => {
  return {
    __interface_tag: 'ts',
    verifyProofAndGetOutput: (
      inputs: PMap<unknown>
    ): Promise<PMap<Either<string, unknown>>> => {
      // Convert FP-style calls to TS-style promises
      return toFailablePromise(host.verifyProofAndGetOutput(inputs));
    },
    checkOutputValidity: (
      output: PMap<unknown>
    ): Promise<PMap<OutputValidity>> => {
      // Convert FP-style calls to TS-style promises
      return toFailablePromise(host.checkOutputValidity(output));
    },
    isReady: (): Promise<boolean> => {
      // Direct conversion as `isReady` could be a simple boolean check or similar
      return toFailablePromise(host.isReady());
    },
    activePluginNames: (): Promise<string[]> => {
      // Direct conversion as `activePluginNames` can return the data directly without conversion
      return toFailablePromise(host.activePluginNames());
    },
    installCustomRoutes: (app: expressCore.Express): Promise<void> => {
      // Direct use as it involves no return type conversion
      return toFailablePromise(host.installCustomRoutes(app));
    }
  };
};

/**
 * Converts a TaskEither operation to a JavaScript Promise using async/await syntax.
 *
 * This function facilitates the integration of TaskEither-based operations into
 * environments that rely on Promises for asynchronous computations. It unwraps
 * the TaskEither, resolving the Promise with the operation's right value or
 * rejecting it with the left value.
 *
 * @param taskEither The TaskEither operation to convert.
 * @returns A Promise that resolves with the right value or rejects with the left value of the TaskEither.
 */
export async function toFailablePromise<T>(
  taskEither: TaskEither<string, T>
): Promise<T> {
  const result = await taskEither();
  if (E.isLeft(result)) {
    // The operation failed, reject the Promise with the left value.
    throw result.left;
  } else {
    // The operation succeeded, resolve the Promise with the right value.
    return result.right;
  }
}
