/**
 * MinAuth library works with two styles or kinds of interfaces:
 * - an idiomatic Typescript interface
 * - a functional interface with the use of fp-ts library
 * MinAuth users are free to select their version, but internally
 * the library uses the functional interface.
 *
 * This module defines utilities to work with interface kinds.
 */
import { TaskEither } from 'fp-ts/lib/TaskEither.js';

/**
 * Interface kind is a type tag that is used to distinguish between
 * the two interface kinds.
 */
export type InterfaceKind = FpInterfaceType | TsInterfaceType;

/**
 * The functional interface kind
 */
export type FpInterfaceType = 'fp';
export const fpInterfaceTag: FpInterfaceType = 'fp';

/**
 * The classical interface kind
 */
export type TsInterfaceType = 'ts';
export const tsInterfaceTag: TsInterfaceType = 'ts';

/**
 * Type-level conditional to choose the type based on the interface kind
 */
export type ChooseType<
  InterfaceType extends InterfaceKind,
  FpType,
  TsType
> = InterfaceType extends FpInterfaceType
  ? FpType
  : InterfaceType extends TsInterfaceType
  ? TsType
  : never;

/**
 * Type representing the return type of an async function based on the interface kind
 */
export type RetType<InterfaceType extends InterfaceKind, T> = ChooseType<
  InterfaceType,
  TaskEither<string, T>,
  Promise<T>
>;

/**
 * A helper type tag to be used in the dynamic plugin modules loading
 */
export interface WithInterfaceTag<IType extends InterfaceKind> {
  readonly __interface_tag: IType;
}
