import React, { useEffect, useState } from 'react';
import Form, { IChangeEvent } from '@rjsf/core';
import { RJSFSchema, ValidatorType } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Logger, ILogObj } from 'tslog';
import { z } from 'zod';
import { MinAuthProof } from 'minauth/dist/common/proof.js';

import {
  PluginRouter,
  SimplePreimageProver,
  Configuration
} from 'minauth-simple-preimage-plugin/dist/prover.js';
import { Field, JsonProof, Poseidon } from 'o1js';
import { ErrorResponse } from '@/helpers/request';
import { AuthResponse, getAuth } from '@/helpers/jwt';

const pluginsBaseURL = 'http://127.0.0.1:3000/plugins';

export const JsonProofSchema = z.object({
  publicInput: z.array(z.string()),
  publicOutput: z.array(z.string()),
  maxProofsVerified: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  proof: z.string()
});

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
    password: { type: 'string', title: 'Password', pattern: '^[0-9]\\d*$' }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validator: ValidatorType<ProverFormData, RJSFSchema, any> =
  customizeValidator({
    customFormats: { BigintString: '/^[1-9]d*$/' }
  });

export const ProverFormDataSchema = z.object({
  password: z.string()
});
export type ProverFormData = z.infer<typeof ProverFormDataSchema>;

const uiSchema = {
  password: {
    'ui:widget': 'password',
    'ui:placeholder': 'Enter your password'
  }
};

export type FormDataChange = ProverFormData | z.ZodError<ProverFormData>;

interface MinAuthProverComponentProps {
  onFormDataChange?: (formData: FormDataChange) => void;
  onSubmissionDataChange?: (submissionData: MinAuthProof | null) => void;
  onAuthenticationResponse?: (response: AuthResponse | ErrorResponse) => void;
  logger?: Logger<ILogObj>;
}

let proverCompiled = false;

const MinAuthProverComponent: React.FC<MinAuthProverComponentProps> = (
  props: MinAuthProverComponentProps
) => {
  // State and useEffect hooks remain unchanged

  const [proverFormData, setProverFormData] = useState<ProverFormData>({
    password: ''
  });
  const [submissionData, setSubmissionData] = useState<MinAuthProof | null>(
    null
  );
  const [prover, setProver] = useState<SimplePreimageProver | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { SimplePreimageProver } = await import(
          'minauth-simple-preimage-plugin/dist/prover'
        );

        const spreConfiguration: Configuration = {
          logger:
            props.logger?.getSubLogger({
              name: 'SimplePreimagePlugin prover'
            }) || new Logger({ name: 'SimplePreimagePlugin prover' }),
          pluginRoutes: new PluginRouter(
            pluginsBaseURL,
            props.logger?.getSubLogger({ name: 'PluginRouter logger' }) ||
              new Logger({ name: 'PluginRouter logger' })
          ),
          compile: false
        };

        props.logger?.info('initializing prover');
        const prover = await SimplePreimageProver.initialize(spreConfiguration);
        props.logger?.info('compiling the prover');
        setProver(prover);
        const { verificationKey } = await SimplePreimageProver.compile();
        proverCompiled = true;
        props.logger?.info('verificationKey', verificationKey);
      } catch (error) {
        props.logger?.error('Error initializing prover:', error);
        throw error;
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
    console.log('proverFormData', proverFormData);
    const preimage = new Field(proverFormData.password);
    const hash = Poseidon.hash([preimage]);

    if (proverCompiled) {
      const proof = await prover.prove(hash, preimage);
      return mkSubmissionData(proof);
    } else {
      props.logger?.error('Prover not compiled');
    }
    return null;
  };

  const buildProofButtonClick = async () => {
    props.logger?.debug('buildProofButtonClick');
    props.logger?.debug('formData', proverFormData);
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
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        formData={proverFormData}
        onChange={(e: IChangeEvent<ProverFormData>) => handleChange(e)}
        className="space-y-4"
      >
        <button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded m-2"
          disabled={proverFormData === null}
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
        <div>
          {Poseidon.hash([new Field(proverFormData.password)]).toString()}
        </div>
      </Form>
    </div>
  );
};

export default MinAuthProverComponent;
