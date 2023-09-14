import { verify, Proof } from 'snarkyjs';

import {ProvePreimageProgram} from "../zkPrograms/hashPreimageProof";


const roleMapping = {
    '21565680844461314807147611702860246336805372493508489110556896454939225549736': 'member',
    '7555220006856562833147743033256142154591945963958408607501861037584894828141': 'admin',
};


export const SimplePreimage = {
    compile,
    getInputs,
    verify: verifyAndGetRoleProgram,
    prove
};

const compile = async () => {
    return await ProvePreimageProgram.compile();
};

const verifyAndGetRoleProgram = async (jsonProof, verificationKey) => {
    if(!verify(jsonProof, verificationKey)){
        return false, 'proof invalid';
    }
    const proof = Proof.fromJSON(jsonProof);
    const role = roleMapping[proof.publicOutput.toString()];
    if(!role) {
        return undefined, 'unknown public input';
    }
    return role, 'role proved';
};

// publicInput, secretInput are decimal encoded strings (results of Field's toString() operation)
const prove = async (publicInput, secretInput) => {
    const proof = await ProvePreimageProgram.baseCase(Field(publicInput), Field(secretInput));
    const proofjson = proof.toJSON();
    return proofjson;
};

const getInputs = async () => {
    return Object.keys(roleMapping);
};


module.exports = SimplePreimage;
