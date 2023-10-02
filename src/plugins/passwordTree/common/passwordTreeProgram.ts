import { Experimental, Field, MerkleWitness, Poseidon, SelfProof, Struct } from "o1js";

// TODO how can this be made dynamic
export const PASSWORD_TREE_HEIGHT = 10;

export class PasswordTreeWitness extends MerkleWitness(PASSWORD_TREE_HEIGHT) {}

export class PasswordInTreeWitness extends Struct({
    witness: PasswordTreeWitness,
    preImage: Field
}) {};

export class MerkleRoot extends Struct({
    root: Field
}) {};


export class ProvePasswordInTreeOutput extends Struct({
    recursiveMekleRootHash: Field,
}) {};

// Prove knowledge of a preimage of a hash in a merkle tree.
// The proof does not reveal the preimage nor the hash.
// The output contains a recursive hash of all the roots for which the preimage is known.
// output = hash(lastRoot + hash(secondLastRoot, ... hash(xLastRoot, lastRoot) ...)
// Therefore the order of the proofs matters.
export const ProvePasswordInTreeProgram = Experimental.ZkProgram({
    publicInput: MerkleRoot,
    publicOutput: ProvePasswordInTreeOutput,

    methods: {
        baseCase: {
            privateInputs: [PasswordInTreeWitness],
            method(publicInput: MerkleRoot, privateInput: PasswordInTreeWitness): ProvePasswordInTreeOutput {
                privateInput.witness
                    .calculateRoot(Poseidon.hash([publicInput.root]))
                    .assertEquals(publicInput.root);
                return new ProvePasswordInTreeOutput(
                    { recursiveMekleRootHash: publicInput.root });
            }
        },

        inductiveCase: {
            privateInputs: [SelfProof, PasswordInTreeWitness],
            method(publicInput: MerkleRoot, earlierProof: SelfProof<MerkleRoot, ProvePasswordInTreeOutput>, privateInput: PasswordInTreeWitness): ProvePasswordInTreeOutput {
                earlierProof.verify();
                privateInput.witness
                    .calculateRoot(Poseidon.hash([publicInput.root]))
                    .assertEquals(publicInput.root);
                return new ProvePasswordInTreeOutput(
                    { recursiveMekleRootHash: Poseidon.hash([publicInput.root, earlierProof.publicOutput.recursiveMekleRootHash]) });
            }
        }
    }
});

export default ProvePasswordInTreeProgram;
