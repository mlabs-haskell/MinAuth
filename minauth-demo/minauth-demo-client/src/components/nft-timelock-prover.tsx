import React, { useEffect, useRef, useState } from 'react';
import Form, { IChangeEvent } from '@rjsf/core';
import { RJSFSchema, ValidatorType } from '@rjsf/utils';
import { Logger, ILogObj } from 'tslog';
import { z } from 'zod';
import { MinAuthProof } from 'minauth/dist/common/proof.js';
import {
  UserCommitmentHex,
  UserCommitmentHexSchema,
  commitmentFieldToHex,
  commitmentHexToField,
  mkUserSecret,
  userCommitmentHex
} from 'minauth-erc721-timelock-plugin/dist/commitment-types.js';
import Erc721TimelockProver, {
  Erc721TimelockProverConfiguration
} from 'minauth-erc721-timelock-plugin/dist/prover.js';

import { MerkleTree } from 'minauth-erc721-timelock-plugin/dist/merkle-tree.js';
import { CircuitString, JsonProof, Poseidon } from 'o1js';
import { AuthResponse, getAuth } from '@/helpers/jwt';
import {
  BrowserProvider,
  Eip1193Provider,
  JsonRpcProvider,
  Signer,
  ethers
} from 'ethers';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { FormDataChange } from './simple-preimage-prover.js';
import { PluginRouter } from 'minauth/dist/plugin/pluginrouter';
import PreimageInputWidget from './preimage-input.js';

interface Ethereum extends Eip1193Provider {}

let counter = 0;

// Extend the Window interface
declare global {
  interface Window {
    ethereum?: Ethereum;
  }
}

let wallet: { provider: BrowserProvider; signer: Signer } | null = null;

const getWallet = async () => {
  if (wallet === null) {
    if (!window.ethereum) {
      throw new Error('No ethereum provider found');
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    wallet = { provider, signer };
  }
  return wallet;
};

const serverURL = 'http://127.0.0.1:3000';

export const JsonProofSchema = z.object({
  publicInput: z.array(z.string()),
  publicOutput: z.array(z.string()),
  maxProofsVerified: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  proof: z.string()
});

type SchemaOptions = {
  commitments: Array<UserCommitmentHex>;
};

const getSchema = (opts: SchemaOptions): RJSFSchema => ({
  title: 'ERC721TimelockProver Form',
  description: 'This form is used to generate a proof.',
  type: 'object',
  required: ['password', 'commitment'],
  properties: {
    preimage: {
      type: 'string',
      title: 'Commitment preimage',
      maxLength: CircuitString.maxLength
    },
    commitment: {
      type: 'string',
      title: 'Available Commitments',
      enum: opts.commitments.map((c) => c.commitmentHex)
    }
  }
});

export const ProverFormDataSchema = z.object({
  preimage: z.string().max(CircuitString.maxLength),
  commitment: z.string().regex(/^0x[0-9a-fA-F]*$/)
});
export type ProverFormData = z.infer<typeof ProverFormDataSchema>;

const uiSchema = {
  preimage: {
    'ui:widget': 'preimageInput',
    'ui:placeholder': 'Enter the preimage of your commitment',
    'ui:options': {
      transformFunction: (input: string) => {
        try {
          return userCommitmentHex(mkUserSecret({ secret: input }))
            .commitmentHex;
        } catch (e) {
          const error = e as Error;
          console.error('Error transforming preimage', input, error.message);
          return error.message;
        }
      }
    }
  },
  commitment: {
    'ui:widget': 'select',
    'ui:placeholder': 'Select a commitment'
  }
};

const widgets = {
  preimageInput: PreimageInputWidget
};

let proverCompiled = false;

const erc721TimelockProverInitialize = async (
  pluginName: string,
  ethereumProvider: BrowserProvider | JsonRpcProvider,
  setProverCompiled: (compiled: boolean) => void,
  pluginLogger?: Logger<ILogObj>
) => {
  const { Erc721TimelockProver } = await import(
    'minauth-erc721-timelock-plugin/dist/prover'
  );

  const logger =
    pluginLogger ?? new Logger({ name: 'ERC721TimelockPlugin prover' });

  const pluginRoutes = await PluginRouter.initialize(
    logger,
    serverURL,
    pluginName
  );

  const erc721tlConfiguration: Erc721TimelockProverConfiguration = {
    pluginRoutes,
    ethereumProvider,
    logger
  };

  const prover = await Erc721TimelockProver.initialize(erc721tlConfiguration, {
    compile: true
  });
  setProverCompiled(true);

  return { prover };
};

// -----------------

const mkSubmissionData = (
  pluginName: string,
  proof: JsonProof
): MinAuthProof => ({
  plugin: pluginName,
  publicInputArgs: {},
  proof
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validator: ValidatorType<ProverFormData, RJSFSchema, any> =
  customizeValidator({});

interface SimplePreimageProverComponentProps {
  pluginName: string;
  onFormDataChange?: (formData: FormDataChange) => void;
  onSubmissionDataChange?: (submissionData: MinAuthProof | null) => void;
  onAuthenticationResponse?: (response: AuthResponse) => void;
  updateProver?: (prover: Erc721TimelockProver) => void;
  logger?: Logger<ILogObj>;
}

/** Component for interating with the ERC721TimelockProver */
const Erc721TimelockProverComponent: React.FC<
  SimplePreimageProverComponentProps
> = (props: SimplePreimageProverComponentProps) => {
  const [proverFormData, setProverFormData] = useState<
    ProverFormData | undefined
  >(undefined);
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );
  const [prover, setProver] = useState<Erc721TimelockProver | null>(null);

  const [currentCommitments, setCurrentCommitments] = useState<
    Array<UserCommitmentHex>
  >([]);

  const checkSecret = (): boolean => {
    const preimage = proverFormData?.preimage || '';
    const commitmentHex = proverFormData?.commitment || '';
    return (
      commitmentHex ===
      userCommitmentHex(mkUserSecret({ secret: preimage })).commitmentHex
    );
  };
  // refresh commitments every 10 seconds
  useEffect(() => {
    const f = async () => {
      // Prevent overlapping calls
      if (!prover || isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      try {
        const response = await prover.fetchEligibleCommitments();
        setCurrentCommitments(response.commitments);
        props.logger?.debug('set commitments', response.commitments);

        props.logger?.debug('-----------------------');
        props.logger?.debug(
          response.commitments.map((x) =>
            commitmentHexToField(x).commitment.toString()
          )
        );

        const merkleTree = new MerkleTree(
          response.commitments.map((x) => commitmentHexToField(x).commitment)
        );
        props.logger?.debug('root:', merkleTree.root.toString());

        const secretHash = mkUserSecret({ secret: '0' });
        const computedCommitmentField = {
          commitment: Poseidon.hash([secretHash.secretHash])
        };
        props.logger?.debug(
          'computedCommitment:',
          computedCommitmentField.commitment.toString(),
          commitmentFieldToHex(computedCommitmentField)
          /* ,
          commitmentHexToField(
* commitmentFieldToHex(computedCommitmentField).commitmentHex
          ).toString() */
        );

        props.logger?.debug(
          'computedCommitment2:',
          commitmentHexToField(
            commitmentFieldToHex(computedCommitmentField)
          ).commitment.toString()
        );

        const witness = merkleTree.getWitness(
          computedCommitmentField.commitment
        );
        const computedRoot = witness.calculateRoot(
          computedCommitmentField.commitment
        );
        props.logger?.debug('computedRoot:', computedRoot);
        props.logger?.error(computedRoot.equals(merkleTree.root));
      } catch (error) {
        const e = error as Error;
        props.logger?.error('Error fetching commitments:', e.message);
        // Optionally, handle the error (e.g., retry mechanism, user notification)
      } finally {
        isFetchingRef.current = false;
      }
    };
    if (!counter) {
      f();
      counter++;
    }
    const intervalId = setInterval(async () => f(), 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [prover, props.logger]);

  // Using useRef to track the fetching status
  const isFetchingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (!window.ethereum) {
          props.logger?.error('No ethereum provider found');
          return;
        }
        const provider = (await getWallet()).provider;
        const { prover } = await erc721TimelockProverInitialize(
          props.pluginName,
          provider,
          (compiled) => {
            proverCompiled = compiled;
          },
          props.logger?.getSubLogger({ name: 'ERC721TimelockPlugin prover' })
        );
        setProver(prover);
        if (props.updateProver) {
          props.updateProver(prover);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          props.logger?.error(
            'Error initializing prover (parsing):',
            error.toString()
          );
        } else {
          props.logger?.error('Error initializing prover:', error);
        }
      }
    })();
  }, [props.pluginName, props.updateProver]); // Ignore the warning

  const buildProof = async (
    proverFormData: ProverFormData
  ): Promise<MinAuthProof | null> => {
    if (prover === null) {
      props.logger?.error('Prover not initialized');
      return null;
    }
    if (!checkSecret()) {
      props.logger?.error('Secret does not match commitment');
      return null;
    }

    if (proverCompiled) {
      let proof: JsonProof;
      try {
        proof = await prover.buildInputAndProve({
          secret: proverFormData.preimage
        });
      } catch (e) {
        props.logger?.error('Error building proof:', e);
        return null;
      }
      return mkSubmissionData(props.pluginName, proof);
    } else {
      props.logger?.error('Prover not compiled');
    }
    return null;
  };

  const buildProofButtonClick = async () => {
    props.logger?.debug('buildProofButtonClick');
    props.logger?.debug('formData', proverFormData);
    if (proverFormData === undefined) {
      props.logger?.error('No form data');
      return;
    }
    const submissionData = await buildProof(proverFormData);
    setSubmissionData(submissionData);
    props.logger?.debug('submissionData set:', submissionData);

    if (props.onSubmissionDataChange) {
      props.onSubmissionDataChange(submissionData);
    }
  };

  const submitProofButtonClick = async () => {
    props.logger?.info('Submitting proof...', submissionData);
    if (submissionData === null) {
      props.logger?.error('No proof to submit');
      return;
    }
    const res = await getAuth(submissionData);
    props.logger?.info('Proof verification (authentication) response', res);
    if (props.onAuthenticationResponse) {
      props.onAuthenticationResponse(res);
    }
  };

  const handleChange = (e: IChangeEvent<ProverFormData>) => {
    if (props?.onFormDataChange && e.formData) {
      const res = ProverFormDataSchema.safeParse(e.formData);
      props.logger?.debug(res);
      if (res.success) {
        props.onFormDataChange(res.data);
        setProverFormData(res.data);
      } else {
        props.logger?.error('Invalid form data', res.error);
        props.onFormDataChange(res.error);
      }
    }
  };

  return (
    <div className="m-4 p-4 bg-white shadow-md rounded-lg">
      <Form
        schema={getSchema({ commitments: currentCommitments })}
        uiSchema={uiSchema}
        widgets={widgets}
        validator={validator}
        formData={proverFormData}
        onChange={(e: IChangeEvent<ProverFormData>) => handleChange(e)}
        className="space-y-4"
      >
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
          disabled={proverFormData === undefined}
          onClick={buildProofButtonClick}
        >
          Generate Proof
        </button>
        <button
          type="submit"
          disabled={submissionData === null}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded m-2"
          onClick={submitProofButtonClick}
        >
          Submit Proof
        </button>
        <div></div>
      </Form>
    </div>
  );
};

interface Erc721TimelockAdminComponentProps {
  prover: Erc721TimelockProver | null;
  logger?: Logger<ILogObj>;
}

export const Erc721TimelockAdminComponent = ({
  prover,
  logger
}: Erc721TimelockAdminComponentProps) => {
  const [tokenIdToLock, setTokenIdToLock] = useState('');
  const [commitmentData, setCommitmentData] = useState('');
  const [tokenIdToUnlock, setTokenIdToUnlock] = useState('');
  const [transactionInfo, setTransactionInfo] = useState('');
  const [walletAddress, setWalletAddress] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!window.ethereum) {
        logger?.error('No ethereum provider found');
        return;
      }
      const { signer } = await getWallet();
      const address = await signer.getAddress();
      setWalletAddress(address);
    })();
  }, []);

  const handleLockNFT = async () => {
    try {
      const commitment = UserCommitmentHexSchema.parse({
        commitmentHex: commitmentData
      });
      if (prover !== null) {
        await prover.lockNft(commitment, parseInt(tokenIdToLock, 10));
        setTransactionInfo('NFT Locked successfully');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger?.error('Error locking NFT (parsing):', error.toString());
      } else {
        logger?.error('Error locking NFT:', error);
      }
      setTransactionInfo('Error locking NFT');
    }
  };

  const handleUnlockNFT = async () => {
    try {
      if (prover !== null) {
        await prover.unlockNft(parseInt(tokenIdToUnlock, 10));
        setTransactionInfo('NFT Unlocked successfully');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger?.error('Error unlocking NFT (parsing):', error.toString());
      } else {
        logger?.error('Error unlocking NFT:', error);
      }
      setTransactionInfo('Error unlocking NFT');
    }
  };

  return (
    <div>
      <div>
        <strong>Ethereum Address:</strong> {walletAddress}
      </div>
      <div>
        <strong>Lock Contract Address:</strong> {prover?.lockContractAddress}
      </div>
      <div>
        <strong>NFT Contract Address:</strong> {prover?.erc721ContractAddress}
      </div>
      <div>
        <input
          type="text"
          value={commitmentData}
          onChange={(e) => setCommitmentData(e.target.value)}
          placeholder="Enter Commitment Data"
        />
        <input
          type="number"
          value={tokenIdToLock}
          onChange={(e) => setTokenIdToLock(e.target.value)}
          placeholder="Enter Token ID to lock"
        />
        <button onClick={handleLockNFT}>Lock NFT</button>
      </div>
      <div>
        <input
          type="number"
          value={tokenIdToUnlock}
          onChange={(e) => setTokenIdToUnlock(e.target.value)}
          placeholder="Enter Token ID to unlock"
        />
        <button onClick={handleUnlockNFT}>Unlock NFT</button>
      </div>
      {transactionInfo && <div>{transactionInfo}</div>}
    </div>
  );
};

export default Erc721TimelockProverComponent;
