import { Field, JsonProof, SelfProof } from "o1js";
import {
    MerkleMembershipTreeWitness,
    MerkleMembershipsOutput,
    MerkleMembershipsPrivateInputs,
    MerkleMembershipsProgram,
    MerkleRoot
} from "../common/merkleMembershipsProgram";
import { IMinAuthProver, IMinAuthProverFactory } from '../../../library/plugin/pluginType';
import A from 'fp-ts/Array'
import O from 'fp-ts/Option'
import axios from "axios";

export type MembershipsProverConfiguration = {
    baseUrl: string
}

export type MembershipsPublicInputArgs =
    Array<{
        treeIndex: bigint,
        leafIndex: bigint
    }>

// Prove that you belong to a set of user without revealing which user you are.
export class MembershipsProver implements
    IMinAuthProver<
        MembershipsPublicInputArgs, // TODO how to fetch
        Array<[MerkleRoot, MerkleMembershipTreeWitness]>,
        Array<Field>>
{
    private readonly cfg: MembershipsProverConfiguration;

    async prove(
        publicInput: Array<[MerkleRoot, MerkleMembershipTreeWitness]>,
        secretInput: Array<Field>)
        : Promise<JsonProof> {
        if (publicInput.length != secretInput.length)
            throw "unmatched public/secret input list"

        const proof: O.Option<SelfProof<MerkleRoot, MerkleMembershipsOutput>> =
            await
                A.reduce
                    (
                        Promise.resolve<O.Option<SelfProof<MerkleRoot, MerkleMembershipsOutput>>>(O.none),
                        (acc, [[root, witness], secret]: [[MerkleRoot, MerkleMembershipTreeWitness], Field]) => {
                            const privInput = new MerkleMembershipsPrivateInputs({ witness, secret })
                            return acc.then(
                                O.match(
                                    () => MerkleMembershipsProgram.baseCase(root, privInput).then(O.some),
                                    (prev) => MerkleMembershipsProgram.inductiveCase(root, prev, privInput).then(O.some)
                                )
                            )
                        }
                    )
                    (A.zip(publicInput, secretInput));

        return O.match(
            () => { throw "empty input list" }, // TODO: make it pure
            (p: SelfProof<MerkleRoot, MerkleMembershipsOutput>) => p.toJSON()
        )(proof);
    }

    async fetchPublicInputs(args: MembershipsPublicInputArgs): Promise<Array<[MerkleRoot, MerkleMembershipTreeWitness]>> {
        const mkUrl = (treeIndex: bigint, leafIndex: bigint) =>
            `${this.cfg.baseUrl}/getRootAndWitness/${treeIndex.toString()}/${leafIndex.toString()}`;
        const getRootAndWitness =
            async (treeIndex: bigint, leafIndex: bigint):
                Promise<[MerkleRoot, MerkleMembershipTreeWitness]> => {
                const url =
                    `${this.cfg.baseUrl}/getRootAndWitness/${treeIndex.toString()}/${leafIndex.toString()}`;
                const resp = await axios.get(url);
                if (resp.status == 200) {
                    const body: {
                        root: string,
                        witness: string
                    } = resp.data;
                    const root = Field.fromJSON(body.root);
                    const witness = MerkleMembershipTreeWitness.fromJSON(body.witness);
                    return [new MerkleRoot({ root }), witness];
                } else {
                    const body: { error: string } = resp.data;
                    throw `error while getting root and witness: ${body.error}`;
                }
            }

        return Promise.all(A.map(
            (args: {
                treeIndex: bigint,
                leafIndex: bigint
            }): Promise<[MerkleRoot, MerkleMembershipTreeWitness]> =>
                getRootAndWitness(args.treeIndex, args.leafIndex)
        )(args));
    }

    constructor(cfg: MembershipsProverConfiguration) {
        this.cfg = cfg;
    }

    static async initialize(cfg: MembershipsProverConfiguration):
        Promise<MembershipsProver> {
        return new MembershipsProver(cfg);
    }
}

MembershipsProver satisfies IMinAuthProverFactory<
    MembershipsProver,
    MembershipsProverConfiguration,
    MembershipsPublicInputArgs,
    Array<[MerkleRoot, MerkleMembershipTreeWitness]>,
    Array<Field>
>

export default MembershipsProver;