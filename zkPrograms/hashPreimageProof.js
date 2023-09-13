import { Field, Experimental, Poseidon} from 'snarkyjs';


export const ProvePreimageProgram = Experimental.ZkProgram({
    publicInput: Field,
    publicOutput: Field,

    methods: {
        baseCase: {
            privateInputs: [Field],
            method(publicInput, secretInput) {
                Poseidon.hash([secretInput]).assertEquals(publicInput);
                return publicInput;
            },
        },
    },
});
