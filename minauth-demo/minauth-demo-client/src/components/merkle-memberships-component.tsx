import React, { useEffect, useState } from 'react';
import Form, { IChangeEvent } from '@rjsf/core';
import { RJSFSchema, ValidatorType } from '@rjsf/utils';
import { Logger, ILogObj } from 'tslog';
import { z } from 'zod';
import { MinAuthProof } from 'minauth/dist/common/proof.js';
import { Field, JsonProof, Poseidon, Cache } from 'o1js';
import { AuthResponse, getAuth } from '@/helpers/jwt';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { FormDataChange } from './simple-preimage-prover.js';
import PreimageInputWidget from './preimage-input.js';
import { mkRequest } from '@/helpers/request';
import MembershipsProver from 'minauth-merkle-membership-plugin/dist/prover.js';
import * as ZkProgram from 'minauth-merkle-membership-plugin/dist/merklemembershipsprogram.js';
import { Either, isLeft } from 'fp-ts/lib/Either';

const serverURL = 'http://127.0.0.1:3000';

export const JsonProofSchema = z.object({
  publicInput: z.array(z.string()),
  publicOutput: z.array(z.string()),
  maxProofsVerified: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  proof: z.string()
});

const getSchema = (merkleRoots: Array<string>): RJSFSchema => ({
  title: "Merkle Memberships Prover's Form",
  description:
    "Prove the 'membership' of a your secres in multiple Merkle Trees. Provide known commitment's preimage for each selected Merkle Tree root to get authentication token with your authorization scope.",
  type: 'object',
  required: ['trees'],
  properties: {
    trees: {
      type: 'array',
      title: 'Merkle Trees',
      items: {
        type: 'object',
        required: ['root', 'preimage'],
        properties: {
          root: {
            type: 'string',
            title: 'Merkle Tree Root',
            enum: merkleRoots
          },
          preimage: {
            type: 'string',
            title: 'Commitment preimage'
          }
        }
      }
    }
  }
});

export const ProverFormDataSchema = z.object({
  trees: z.array(
    z.object({
      root: z.string(),
      preimage: z.string()
    })
  )
});

export type ProverFormData = z.infer<typeof ProverFormDataSchema>;

const uiSchema = {
  trees: {
    items: {
      root: {
        'ui:widget': 'select',
        'ui:placeholder': 'Select a Merkle Tree'
      },
      preimage: {
        'ui:widget': 'preimageInput',
        'ui:placeholder': 'Enter the preimage of your commitment',
        'ui:options': {
          transformFunction: (input: bigint) => {
            try {
              return Poseidon.hash([new Field(input)]).toString();
            } catch (e) {
              const error = e as Error;
              console.error(
                'Error transforming preimage',
                input,
                error.message
              );
              return error.message;
            }
          }
        }
      }
    }
  }
};

const widgets = {
  preimageInput: PreimageInputWidget
};

let proverCompiled = false;

const merkleMembershipProverInitialize = async (
  pluginName: string,
  setProverCompiled: (compiled: boolean) => void,
  logger?: Logger<ILogObj>
) => {
  const pluginsUrl = `${serverURL}/plugins/${pluginName}`;
  const merkleRootsResp = await mkRequest(
    `${pluginsUrl}/getTreeRoots`,
    z.array(z.string())
  );

  // if tree roots fetch incorrectly throw
  if (merkleRootsResp.type !== 'ok') {
    logger?.error('Error fetching tree roots', merkleRootsResp.message);
    throw new Error(merkleRootsResp.message);
  }
  logger?.debug('Merkle roots fetched', merkleRootsResp.data);

  logger?.debug('Compiling the prover...');
  await ZkProgram.Program.compile({ cache: Cache.None });
  const proverE: Either<string, MembershipsProver> =
    await MembershipsProver.initialize(
      { baseUrl: serverURL },
      { compile: false }
    )();

  if (isLeft(proverE)) {
    throw new Error(proverE.left);
  }

  const prover = proverE.right;

  logger?.debug('Prover compiled');

  setProverCompiled(true);

  return { prover, merkleRoots: merkleRootsResp.data };
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

interface MembershipsProverComponentProps {
  pluginName: string;
  onFormDataChange?: (formData: FormDataChange) => void;
  onSubmissionDataChange?: (submissionData: MinAuthProof | null) => void;
  onAuthenticationResponse?: (response: AuthResponse) => void;
  updateProver?: (prover: MembershipsProver) => void;
  logger?: Logger<ILogObj>;
}

const MembershipsProverComponent: React.FC<MembershipsProverComponentProps> = (
  props: MembershipsProverComponentProps
) => {
  const [proverFormData, setProverFormData] = useState<
    ProverFormData | undefined
  >(undefined);
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );
  const [prover, setProver] = useState<MembershipsProver | null>(null);
  const [merkleRoots, setMerkleRoots] = useState<Array<string>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { prover, merkleRoots } = await merkleMembershipProverInitialize(
          props.pluginName,
          (compiled) => {
            proverCompiled = compiled;
          },
          props.logger
        );
        setProver(prover);
        setMerkleRoots(merkleRoots);
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

    if (proverCompiled) {
      let proof: JsonProof;
      try {
        throw new Error('Not implemented');
        /* proof = await prover.buildInputAndProve({
         *   secret: proverFormData.preimage
         * }); */
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
        schema={getSchema(merkleRoots)}
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

export default MembershipsProverComponent;
