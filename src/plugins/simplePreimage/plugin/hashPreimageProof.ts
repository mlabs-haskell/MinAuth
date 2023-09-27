import { Field, Experimental, Poseidon } from 'o1js';

export const ProvePreimageProgram = Experimental.ZkProgram({
    publicInput: Field,
    publicOutput: Field,

    methods: {
        baseCase: {
            privateInputs: [Field],
            method(publicInput: Field, secretInput: Field) {
                Poseidon.hash([secretInput]).assertEquals(publicInput);
                return publicInput;
            },
        },
    },
});

export const ProvePreimageProofClass = Experimental.ZkProgram.Proof(ProvePreimageProgram);

export default ProvePreimageProgram;
