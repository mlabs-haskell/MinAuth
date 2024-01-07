import React, { useEffect, useRef, useState } from 'react';
import Form, { IChangeEvent } from '@rjsf/core';
import { RJSFSchema, ValidatorType } from '@rjsf/utils';
import { Logger, ILogObj } from 'tslog';
import { z } from 'zod';
import { MinAuthProof } from 'minauth/dist/common/proof.js';
import {
  UserCommitmentHex,
  UserCommitmentHexSchema,
  mkUserSecret,
  userCommitmentHex
} from 'minauth-erc721-timelock-plugin/dist/commitment-types.js';
import Erc721TimelockProver, {
  Erc721TimelockProverConfiguration,
  PluginRouter
} from 'minauth-erc721-timelock-plugin/dist/prover.js';
import { CircuitString, JsonProof } from 'o1js';
import { AuthResponse, getAuth } from '@/helpers/jwt';
import { BrowserProvider, JsonRpcProvider } from 'ethers';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { FormDataChange } from './minauth-prover-component';

const pluginsBaseURL = 'http://127.0.0.1:3000/plugins';

export const JsonProofSchema = z.object({
  publicInput: z.array(z.string()),
  publicOutput: z.array(z.string()),
  maxProofsVerified: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  proof: z.string()
});

// plugin specific
const pluginName = 'erc721-timelock';

/* const  a: JSONSchema7 | null = null; */

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
  password: {
    'ui:widget': 'password',
    'ui:placeholder': 'Enter the preimage of your commitment'
  },
  commitment: {
    'ui:widget': 'select',
    'ui:placeholder': 'Select a commitment'
  }
};

let proverCompiled = false;

const erc721TimelockProverInitialize = async (
  ethereumProvider: BrowserProvider | JsonRpcProvider,
  setProverCompiled: (compiled: boolean) => void,
  pluginLogger?: Logger<ILogObj>
) => {
  const { Erc721TimelockProver } = await import(
    'minauth-erc721-timelock-plugin/dist/prover'
  );

  const logger =
    pluginLogger ?? new Logger({ name: 'ERC721TimelockPlugin prover' });
  const erc721tlConfiguration: Erc721TimelockProverConfiguration = {
    logger,
    pluginRoutes: new PluginRouter(logger, pluginsBaseURL),
    ethereumProvider
  };

  const prover = await Erc721TimelockProver.initialize(erc721tlConfiguration, {
    compile: true
  });
  setProverCompiled(true);

  return { prover };
};

// -----------------

const mkSubmissionData = (proof: JsonProof): MinAuthProof => ({
  plugin: pluginName,
  publicInputArgs: {},
  proof
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validator: ValidatorType<ProverFormData, RJSFSchema, any> =
  customizeValidator({});

interface MinAuthProverComponentProps {
  onFormDataChange?: (formData: FormDataChange) => void;
  onSubmissionDataChange?: (submissionData: MinAuthProof | null) => void;
  onAuthenticationResponse?: (response: AuthResponse) => void;
  updateProver?: (prover: Erc721TimelockProver) => void;
  logger?: Logger<ILogObj>;
}

const Erc721TimelockProverComponent: React.FC<MinAuthProverComponentProps> = (
  props: MinAuthProverComponentProps
) => {
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
    const commitment = proverFormData?.commitment || { commitmentHex: '' };
    return commitment === userCommitmentHex(mkUserSecret({ secret: preimage }));
  };
  // refresh commitments every 10 seconds
  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Prevent overlapping calls
      if (!prover || isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      try {
        const response = await prover.fetchEligibleCommitments();
        setCurrentCommitments(response.commitments);
        props.logger?.debug('set commitments', response.commitments);
      } catch (error) {
        props.logger?.error('Error fetching commitments:', error);
        // Optionally, handle the error (e.g., retry mechanism, user notification)
      } finally {
        isFetchingRef.current = false;
      }
    }, 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [prover, props.logger]);

  // Using useRef to track the fetching status
  const isFetchingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const provider = new JsonRpcProvider('http://localhost:8545');
        const { prover } = await erc721TimelockProverInitialize(
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
      } catch (err) {
        props.logger?.error('Error initializing prover', err);
      }
    })();
  }, []); // Ignore the warning

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
      const proof = await prover.buildInputAndProve({
        secret: proverFormData.preimage
      });
      return mkSubmissionData(proof);
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

  const handleLockNFT = async () => {
    try {
      const commitment = UserCommitmentHexSchema.parse(commitmentData);
      if (prover !== null) {
        await prover.lockNft(commitment, parseInt(tokenIdToLock, 10));
        setTransactionInfo('NFT Locked successfully');
      }
    } catch (error) {
      logger?.error('Error locking NFT:', error);
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
      logger?.error('Error unlocking NFT:', error);
      setTransactionInfo('Error unlocking NFT');
    }
  };

  return (
    <div>
      <div>
        <strong>Ethereum Provider:</strong> {prover?.ethereumProvider}
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
