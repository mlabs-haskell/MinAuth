// TODO requires changes
import { Field, JsonProof } from "o1js";
import ProvePasswordInTreeProgram, { PasswordInTreeWitness } from "../common/passwordTreeProgram";
import { IMinAuthProver, IMinAuthProverFactory } from '../../../library/plugin/pluginType';

import axios from "axios";

export type MemberSetProverConfiguration = {
    apiServer: URL,
}


// Prove that you belong to a set of user without revealing which user you are.
export class MemberSetProver implements
    IMinAuthProver<bigint, PasswordInTreeWitness, Field>
{
    private readonly cfg: MemberSetProverConfiguration;

    async prove(publicInput: PasswordInTreeWitness, secretInput: Field)
        : Promise<JsonProof> {
        const proof = await ProvePasswordInTreeProgram.baseCase(
            publicInput, Field.from(secretInput));
        return proof.toJSON();
    }

    async fetchPublicInputs(uid: bigint): Promise<PasswordInTreeWitness> {
        const mkUrl = (endpoint: string) => `${this.cfg.apiServer}/${endpoint}`;
        const getWitness = async (): Promise<PasswordInTreeWitness> => {
            const resp = await axios.get(mkUrl(`/witness/${uid.toString()}`));
            if (resp.status != 200) {
                throw `unable to fetch witness for ${uid.toString()}, error: ${(resp.data as { error: string }).error}`;
            }
            return PasswordInTreeWitness.fromJSON(resp.data);
        };
        const getRoot = async (): Promise<Field> => {
            const resp = await axios.get(mkUrl('/root'));
            return Field.fromJSON(resp.data);
        }
        const witness = await getWitness();
        const root = await getRoot();

        return new PasswordInTreeWitness({ witness, root });
    }

    constructor(cfg: MemberSetProverConfiguration) {
        this.cfg = cfg;
    }

    static async initialize(cfg: MemberSetProverConfiguration):
        Promise<MemberSetProver> {
        return new MemberSetProver(cfg);
    }
}

MemberSetProver satisfies IMinAuthProverFactory<
    MemberSetProver,
    MemberSetProverConfiguration,
    bigint,
    PasswordInTreeWitness,
    Field
    >
