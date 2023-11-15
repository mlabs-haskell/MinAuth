import { Field, JsonProof } from 'o1js';
import { ProverMetadata, PublicInputList } from '../pluginType';
import ProvePreimageProgram from './hashPreimageProof';
import { UiSchema } from '@rjsf/utils';
import z from 'zod';

export const PublicInputSchema = z.object({
  hash: z.string()
});
export const SecretInputSchema = z.object({
  preimage: z.string()
});

// Public input type of the prover's prove method
// - not the zkcircuits itself
export type PublicInput = z.infer<typeof PublicInputSchema>;

// Secret input type of the prover's prove method
// - not the zkcircuits itself
// For example there could be recursive proof necessary
// and prover's secret inputs accounts for a list of consecutive
// secret inputs
export type SecretInput = z.infer<typeof SecretInputSchema>;

// TODO
export const ServerConfigSchema = z.object({});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export class SimplePreimageProver {
  private _serverConfig: ServerConfig;

  // =============== prover API ===============

  // The 'public constructor' of the class
  static async initialize(
    serverConfig: ServerConfig
  ): Promise<SimplePreimageProver> {
    const ret = new SimplePreimageProver(serverConfig);
    // possible reduce the state if this caching turnes our to be unnecessary
    await ret._fetchAndCacheMetadata();
    await ret._fetchAndCacheInteractionSchema();
    return ret;
  }

  private constructor(serverConfig: ServerConfig) {
    this._serverConfig = serverConfig;
  }

  // Compiles the circuit and caches the verification key.
  // This may take some time. Before serializing compiled circuit is supported,
  // consider running this in a web worker.
  // NOTE. this is the only place where `_verificationKey` should be written.
  static async compileCircuit(): Promise<{ verificationKey: string }> {
    console.log('compiling ProvePreimageProgram');
    const { verificationKey } = await ProvePreimageProgram.compile();
    SimplePreimageProver._verificationKey = verificationKey;
    console.log(`compiled. verificationKey set: ${verificationKey}`);
    return { verificationKey };
  }

  // Returns description of the prover inputs necessary to build an input form
  // and a function to transform the form data into the prover input.
  async getInteractionSchema() {
    // TODO - the type

    // This prover has a static  (but server-side) set of public inputs.
    // const pis = await this.listPublicInputs();

    //  A json schema enlisting all the public inputs for creating a multiselect field with the help of uniforms library
    const dataSchema = null; // TODO

    //
    const uiSchema: UiSchema = {}; // TODO

    const validate = null;

    const resolveFormData = null;

    return {
      dataSchema,
      uiSchema,
      validate,
      resolveFormData
    };

    // const proverConfig = await this.getProverConfig();

    // // for (const pi of pis) {
    // //     const schema = await this.getPublicInput(pi.id);
    // //     pi.schema = schema;
    // // }
    // const publicInputEnum = [] as string[]; // TODO

    // // change to json schema
    //     const formSchema = z.object({
    //         secretPreimage: z.string(),
    //     desiredRole: z.enum(publicInputEnum)
    // });
    // const formDataResolver = undefined

    // return {
    //   formSchema: null, // the helper form schema
    //   formDataResolver: (x: any) => x // transform the form data into the prover input
    // };
  }

  async prove(
    publicInput: PublicInput,
    secretInput: SecretInput
  ): Promise<JsonProof> {
    console.log('simplePreimage proving for', publicInput, secretInput);
    const proof = await ProvePreimageProgram.baseCase(
      Field(publicInput.hash),
      Field(secretInput.preimage)
    );
    return proof.toJSON();
  }

  // =============== zk-circuit interactions ===============
  private static _verificationKey: string | undefined = undefined;

  static get verificationKey(): string {
    if (SimplePreimageProver._verificationKey === undefined) {
      throw 'Verification key not set. Please call `compileCircuit` first.';
    }
    return SimplePreimageProver._verificationKey;
  }

  // in case direct access to the circuit is needed
  static get zkCircuit(): typeof ProvePreimageProgram {
    return ProvePreimageProgram;
  }

  // =============== interaction schemas and documentation  ===============

  // private _interactionSchema: typeof undefined = undefined;
  private _metadata: ProverMetadata = SimplePreimageProver.staticMetadata;

  static get staticMetadata(): ProverMetadata {
    // Fetch or acquire the metadata from the proof builder.
    // This is a mocked example:
    return {
      id: 'simplePreimage',
      name: 'Simple Preimage Prover',
      description: {
        general:
          'The server keeps a fixed set of hashes. Each hash is associated with a role you have in the system. You can prove that you have a role by providing the preimage of the hash.',
        secret_input: 'The preimage of the hash.',
        public_input: 'The hash.'
      }
    };
  }

  // Metadata that might have been set by the server
  get metadata(): ProverMetadata {
    return this._metadata;
  }

  // =============== initialization ===============
  public get serverConfig(): ServerConfig {
    return this._serverConfig;
  }

  private async _fetchAndCacheMetadata(): Promise<void> {
    // Fetch or acquire the metadata from the proof builder.
    // TODO
    this._metadata = SimplePreimageProver.staticMetadata;
  }

  private async _fetchAndCacheInteractionSchema(): Promise<void> {
    // Fetch or acquire the metadata from the proof builder.
    // TODO
    // this._interactionSchema = undefined;
  }

  // =============== server interactions ===============

  // TODO use plugins routes instead of the mocked data
  async listPublicInputs(): Promise<PublicInputList> {
    return [
      {
        id: 'admin',
        name: 'Admin-level access',
        description: 'The hash for the admin role.'
      },
      {
        id: 'member',
        name: 'Member-level access',
        description: 'The hash for the member role.'
      }
    ];
  }

  // TODO use plugins routes instead of the mocked data
  async getPublicInput(id: string): Promise<PublicInput> {
    const m: Record<string, string> = {
      admin:
        '7555220006856562833147743033256142154591945963958408607501861037584894828141',
      member:
        '21565680844461314807147611702860246336805372493508489110556896454939225549736'
    };
    if (!(id in m)) {
      throw 'invalid public input id';
    }
    return {
      hash: m[id]
    };
  }

  async getProverConfig() {
    throw new Error('Method not implemented.');
  }
}
