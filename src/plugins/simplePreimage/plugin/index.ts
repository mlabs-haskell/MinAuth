import { verify, Proof, Field, JsonProof, Experimental } from 'o1js';
import { IMinAuthPlugin, IMinAuthPluginFactory, IMinAuthProver, PluginType } from '../../../library/plugin/pluginType';
import ProvePreimageProgram, { ProvePreimageProofClass } from './hashPreimageProof';
import { RequestHandler } from 'express';
import { z } from 'zod';


const roleMapping: Record<string, string> = {
    '7555220006856562833147743033256142154591945963958408607501861037584894828141':
        'admin',
    '21565680844461314807147611702860246336805372493508489110556896454939225549736':
        'member',
};

const compile = async (): Promise<string> => {
    console.log('Compiling SimplePreimage plugin');
    console.log(ProvePreimageProgram);
    const { verificationKey } = await ProvePreimageProgram.compile();
    return verificationKey;
};

const verifyAndGetRoleProgram = async (
    jsonProof: JsonProof,
    verificationKey: string,
): Promise<[string | boolean | undefined, string]> => {
    if (!verify(jsonProof, verificationKey)) {
        return [false, 'proof invalid'];
    }
    const proof = ProvePreimageProofClass.fromJSON(jsonProof);
    const role = roleMapping[proof.publicOutput.toString()];
    if (!role) {
        return [undefined, 'unknown public input'];
    }
    return [role, 'role proved'];
};

const prove = async (inputs: string[]): Promise<undefined | JsonProof> => {
    const [publicInput, secretInput] = inputs;
    console.log('simplePreimage proving for', publicInput, secretInput);
    const proof = await ProvePreimageProgram.baseCase(
        Field(publicInput),
        Field(secretInput),
    );
    return proof.toJSON();
};

const getInputs = async (): Promise<string[]> => {
    return Object.keys(roleMapping);
};

export const SimplePreimage: PluginType = {
    compile,
    getInputs,
    verify: verifyAndGetRoleProgram,
    prove,
};

export default SimplePreimage;


export class SimplePreimagePlugin implements IMinAuthPlugin<any, string>{
    readonly verificationKey: string;
    private readonly roles: Record<string, string>;

    async verifyAndGetOutput(_: any, serializedProof: JsonProof):
        Promise<string> {
        const proof = ProvePreimageProofClass.fromJSON(serializedProof);
        const role = roleMapping[proof.publicOutput.toString()];
        return role;
    };

    publicInputArgsSchema: z.ZodType<any> = z.any();

    customRoutes: Record<string, RequestHandler> = {
        "/roles": (_, res) => {
            res.status(200).json(this.roles);
        }
    }

    // checkOutputValidity(output: string): Promise<boolean> {
    //     return Promise.resolve(output in this.roles);
    // }

    constructor(verificationKey: string, roles: Record<string, string>) {
        this.verificationKey = verificationKey;
        this.roles = roles;
    }

    static async initialize(configuration: { roles: Record<string, string> })
        : Promise<SimplePreimagePlugin> {
        const { verificationKey } = await ProvePreimageProgram.compile();
        return new SimplePreimagePlugin(verificationKey, configuration.roles);
    };

    static readonly configurationSchema: z.ZodType<{ roles: Record<string, string> }> =
        z.object({
            roles: z.record(
                // FIXME: the key should be a valid poseidon hash
                z.string(),
                z.string())
        });
}

// sanity check
SimplePreimagePlugin satisfies IMinAuthPluginFactory<SimplePreimagePlugin, { roles: Record<string, string> }, any, string>;

export class SimplePreimageProver implements IMinAuthProver<any, Field, Field>{
    async prove(publicInput: Field, secretInput: Field): Promise<JsonProof> {
        console.log('simplePreimage proving for', publicInput, secretInput);
        const proof = await ProvePreimageProgram.baseCase(
            Field(publicInput),
            Field(secretInput),
        );
        return proof.toJSON();
    }

    async fetchPublicInputs(_: any): Promise<Field> {
        throw "not implemented, please query the `/roles` endpoint";
    }

    static async initialize(_: any): Promise<SimplePreimageProver> {
        return new SimplePreimageProver();
    }
}

