import { Cache, PublicKey, verify } from 'o1js';
import {
  IMinAuthPlugin,
  IMinAuthPluginFactory,
  OutputValidity,
  outputInvalid,
  outputValid
} from 'minauth/dist/plugin/plugintype.js';
import ProvePreimageProgram from './hash-preimage-proof.js';
import { Router } from 'express';
import { z } from 'zod';
import { TsInterfaceType } from 'minauth/dist/plugin/interfacekind.js';
import {
  wrapZodDec,
  combineEncDec,
  noOpEncoder
} from 'minauth/dist/plugin/encodedecoder.js';
import { Logger } from 'minauth/dist/plugin/logger.js';
import { VerificationKey } from 'minauth/dist/common/verificationkey.js';
import { JsonProofSchema } from 'minauth/dist/common/proof.js';
import { ZkClaimSubplugin } from './zkclaim.js';


// TODO
export const configurationSchema = z.unknown()

export type Configuration = z.infer<typeof configurationSchema>;

export const InputSchema = z.object(
  { proof: JsonProofSchema
  , additionalData: z.array(z.unknown()) // TODO considering making it into a template
  });

export type Input = z.infer<typeof InputSchema>;


export const OutputSchema = z.object({ provedClaims: z.array(z.unknown()) }); // TODO considering making it into a template

export type Output = z.infer<typeof OutputSchema>;

/**
 * TODO
 * The plugin allows to use zk cryptographically secure proofs of claims
 * on the zk-documents to be used as a source of authentication.
 * See README.md for more details.
 */
export class ZkDocumentClaimsPlugin
  implements IMinAuthPlugin<TsInterfaceType, Input, Output>
{
  /**
   * This plugin uses an idiomatic Typescript interface
   */
  readonly __interface_tag = 'ts';

  /** The plugin's logger */
  protected readonly logger: Logger;

  /**
   *  A memoized main authorization zk-circuit verification key
   */
  readonly verificationKey: VerificationKey;

  /**
   *  The mapping between hashes and claims
   */
  readonly zkClaimsSubplugins: Record<string, ZkClaimSubplugin>;

  /**
   *  The mapping between hashes and claims
   */
  readonly trustedIssuers: Record<string, PublicKey>;

  /**
   * Verify a proof and return the verified claims.
   */
  async verifyAndGetOutput(inp: Input): Promise<Output> {
    // TODO
    return Promise.resolve({ provedClaims: [] });
  }

  /**
   */
  readonly customRoutes = Router()

  /**
   * Check if produced output is still valid.
   * - check if the isueer is still trusted
   * - foreach claim check it's validation rules:
   *   - for example for the timestamp validity claim the validity timestamp
   *   - can be checked if the date is still in the future
   */
  async checkOutputValidity(output: Output): Promise<OutputValidity> {
    // TODO
    return Promise.resolve(outputValid);
  }

  /**
   * This ctor is meant ot be called by the `initialize` function.
   */
  constructor(
    verificationKey: VerificationKey,
    logger: Logger
  ) {
    this.verificationKey = verificationKey;
    this.logger = logger;
  }

  static readonly __interface_tag = 'ts';

  /**
   * Initialize the plugin with a configuration.
   */
  static async initialize(
    configuration: Configuration,
    logger: Logger
  ): Promise<ZkDocumentClaimsPlugin> {
   const { verificationKey } = await ProvePreimageProgram.compile({
      cache: Cache.None
    });
    return new ZkDocumentClaimsPlugin(verificationKey, logger);
  }

  static readonly configurationDec = wrapZodDec('ts', configurationSchema);

  readonly inputDecoder = wrapZodDec(
    'ts',
    InputSchema
  );

  /** output parsing and serialization */
  readonly outputEncDec = combineEncDec(
    noOpEncoder('ts'),
    wrapZodDec('ts', OutputSchema)
  );
}

// sanity check
ZkDocumentClaimsPlugin satisfies IMinAuthPluginFactory<
  TsInterfaceType,
  ZkDocumentClaimsPlugin,
  Configuration
>;

export default ZkDocumentClaimsPlugin
