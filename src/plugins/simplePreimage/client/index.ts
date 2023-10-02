import { Field, JsonProof } from 'o1js';
import { IMinAuthProver } from '../../../library/plugin/pluginType';
import ProvePreimageProgram from '../common/hashPreimageProof';


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

