import { verify, Proof, Field, JsonProof, Experimental } from 'snarkyjs';
import { ProvePreimageProgram } from 'hashPreimageProof';
import { PluginType } from '../../../library/plugin/pluginType';


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
