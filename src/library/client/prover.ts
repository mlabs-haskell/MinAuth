import {
  InterfaceKind,
  RetType,
  WithInterfaceTag
} from '@lib/common/interfaceKind';
import { JsonProof } from 'o1js';

// Interfaces used on the client side.

/**
 * IMinAuthProver defines the part of MinAuth plugin that is used by the client
 * - the party that wants to present a proof qualifying for access to a resource.
 * The interface type is parameterized by an interface kind:
 * - `TsInterfaceType` for idiomatic typescript interface
 * - `FpInterfaceType` for functional style interface
 * that is usd by the library to provide safety and composability.
 * A plugin author is free to implement the prover using any interface,
 * the library will convert it to the functional style interface for internal use.
 *
 * @param InterfaceType - the interface kind
 * @param PublicInputArgs - used to parameterize the way in which public inputs
 * are prepared for the proof.
 * @param PublicInput - the type of public input needed to produce a proof.
 * @param PrivateInput - the type of private input needed to produce a proof.
 */
export interface IMinAuthProver<
  InterfaceType extends InterfaceKind,
  PublicInputArgs,
  PublicInput,
  PrivateInput
> extends WithInterfaceTag<InterfaceType> {
  prove(
    publicInput: PublicInput,
    secretInput: PrivateInput
  ): RetType<InterfaceType, JsonProof>;

  fetchPublicInputs(args: PublicInputArgs): RetType<InterfaceType, PublicInput>;
}

/**
 * IMinAuthProverFactory encapsulates the logic of creating a prover.
 * The meaning of its type parameters can be looked up in the documentation
 * of `IMinAuthProver`.
 */
export interface IMinAuthProverFactory<
  ProverType extends IMinAuthProver<
    InterfaceType,
    PublicInputArgs,
    PublicInput,
    PrivateInput
  >,
  InterfaceType extends InterfaceKind,
  Configuration,
  PublicInputArgs,
  PublicInput,
  PrivateInput
> extends WithInterfaceTag<InterfaceType> {
  initialize(cfg: Configuration): RetType<InterfaceType, ProverType>;
}
