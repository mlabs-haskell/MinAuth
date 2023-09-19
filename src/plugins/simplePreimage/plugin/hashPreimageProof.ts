import { Field, Experimental, Poseidon } from 'snarkyjs';

export const ProvePreimageProofClass = Experimental.ZkProgram.Proof(ProvePreimageProgram);

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

export default ProvePreimageProgram;
