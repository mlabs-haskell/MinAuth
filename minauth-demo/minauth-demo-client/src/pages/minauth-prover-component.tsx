// components/ProverForm.tsx

import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import React, { useEffect, useState } from 'react';
import Form from '@rjsf/core';
import { Logger, ILogObj } from 'tslog';

import { SimplePreimageProver } from 'minauth-simple-preimage-plugin/prover.js';
import { Field, JsonProof, Poseidon } from 'o1js';

export interface MinAuthProof {
  plugin: string;
  publicInputArgs: unknown;
  proof: JsonProof;
}
const mkSubmissionData = (proof: JsonProof): MinAuthProof => ({
  plugin: 'simple-preimage',
  publicInputArgs: {},
  proof
});

const schema: RJSFSchema = {
  title: 'Prover Form',
  description: 'This form is used to generate a proof.',
  type: 'object',
  required: ['password'],
  properties: {
    password: { type: 'string', title: 'Password' }
  }
};

type ProverFormData = {
  password: string;
};

const uiSchema = {
  password: {
    'ui:widget': 'password',
    'ui:placeholder': 'Enter your password'
  }
};

interface MinAuthProverComponentProps {
  onFormDataChange?: (formData: ProverFormData) => void;
  onSubmissionDataChange?: (submissionData: MinAuthProof | null) => void;
  logger?: Logger<ILogObj>;
}

const MinAuthProverComponent: React.FC<MinAuthProverComponentProps> = (
  props: MinAuthProverComponentProps
) => {
  const [proverFormData, setProverFormData] = useState<ProverFormData>({
    password: ''
  });
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );
  const [proverVerificationKey, setProverVerificationKey] = useState<{
    verificationKey: string;
  }>({ verificationKey: '' });
  const [prover, setProver] = useState<SimplePreimageProver | null>(null);

  useEffect(() => {
    (async () => {
      const { SimplePreimageProver } = await import(
        'minauth-simple-preimage-plugin/prover'
      );
      console.log('Compiling the prover...');
      const { verificationKey } = await SimplePreimageProver.compile();
      setProverVerificationKey({ verificationKey });
      console.log('verificationKey', verificationKey);
      const proverlogger: Logger<ILogObj> =
        props.logger?.getSubLogger({ name: 'SimplePreimagePlugin prover' }) ||
        new Logger({ name: 'SimplePreimagePlugin prover' });
      const prover = await SimplePreimageProver.initialize(proverlogger, false);
      setProver(prover);
    })();
  }, []);

  const buildProof = async (
    proverFormData: ProverFormData
  ): Promise<MinAuthProof | null> => {
    if (prover === null) {
      return null;
    }
    const preimage = new Field(proverFormData.password);
    const hash = Poseidon.hash([preimage]);

    const proof = await prover.prove(hash, preimage);
    return mkSubmissionData(proof);
  };

  const buildProofButtonClick = async () => {
    props.logger?.debug('buildProofButtonClick');
    props.logger?.debug('formData', proverFormData);
    const submissionData = await buildProof(proverFormData);
    setSubmissionData(submissionData);
    props.logger?.debug('submissionData set:', submissionData);

    if (props?.onSubmissionDataChange) {
      props.onSubmissionDataChange(submissionData);
    }
  };

  const submitProofButtonClick = async () => {
    props.logger?.debug('buildProofButtonClick');
    console.log('Submitting proof...');
  };

  return (
    <div>
      <Form
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        formData={proverFormData}
        onChange={(e: any) => setProverFormData(e.formData)}
      >
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={buildProofButtonClick}
        >
          Generate Proof
        </button>
        <button
          type="submit"
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          onClick={submitProofButtonClick}
        >
          Submit Proof
        </button>
      </Form>
    </div>
  );
};

export default MinAuthProverComponent;

/*
 *
 * // should be created by the prover and come from `prove()`
 * interface MinAuthProof {
 *   plugin: string;
 *   publicInputArgs: unknown;
 *   proof: JsonProof;
 * }
 *
 * const mkProof = (proof: JsonProof, publicInputArgs: Field): MinAuthProof => ({
 *   plugin: 'simple-preimage',
 *   publicInputArgs,
 *   proof
 * });
 *
 * async function postMinAuthProof(minAuthProof: MinAuthProof): Promise<Response> {
 *   const url = 'http://localhost:3000/login';
 *   const headers = {
 *     'Content-Type': 'application/json'
 *   };
 *
 *   try {
 *     const response = await fetch(url, {
 *       method: 'POST',
 *       headers: headers,
 *       body: JSON.stringify(minAuthProof)
 *     });
 *
 *     if (!response.ok) {
 *       throw new Error(`HTTP error! status: ${response.status}`);
 *     }
 *
 *     return response;
 *   } catch (error) {
 *     console.error('Error posting MinAuthProof:', error);
 *     throw error;
 *   }
 * }
 *
 * const submitProof = async (proof: MinAuthProof) => {
 *   postMinAuthProof(proof)
 *     .then((response) => {
 *       // Handle the response
 *       console.log('Success:', response);
 *     })
 *     .catch((error) => {
 *       // Handle errors
 *       console.error('Error:', error);
 *     });
 * }; */
