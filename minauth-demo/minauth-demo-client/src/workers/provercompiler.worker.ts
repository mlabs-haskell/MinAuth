/// <reference lib="webworker" />
import {
  ProverCompilationResult,
  ProverZkCircuit
} from './provercompilertypes';
import { SimplePreimageProver } from 'minauth-simple-preimage-plugin/prover';
import { MembershipsProver } from 'minauth-merkle-membership-plugin/prover';
import { launchTE } from 'minauth/utils/fp/taskeither';

const postResult = (result: ProverCompilationResult) => {
  console.log('Worker output:', result);
  postMessage(JSON.stringify(result));
};

addEventListener('message', async (event: MessageEvent<string>) => {
  try {
    const message = JSON.parse(event.data) as ProverZkCircuit;

    console.log('Message received from main script', event.data);
    postResult({ status: 'processing' });

    switch (message.type) {
      case 'SimplePreimage':
        try {
          const result: { verificationKey: string } =
            await SimplePreimageProver.compile();
          postResult({ status: 'success', result });
        } catch (e) {
          postResult({
            status: 'error',
            error: {
              message: 'Error during SimplePreimageProver compilation',
              error: e
            }
          });
        }
        break;
      case 'MerkleMemberships':
        try {
          const result = await launchTE(MembershipsProver.compile());
          postResult({ status: 'success', result });
        } catch (e) {
          postResult({
            status: 'error',
            error: {
              message: 'Error during SimplePreimageProver compilation',
              error: e
            }
          });
        }
        break;
      default: {
        postResult({
          status: 'error',
          error: { message: 'Unknown prover zk circuit' }
        });
      }
    }
  } catch (e) {
    postResult({
      status: 'error',
      error: { message: 'Unknown error in web worker', error: e }
    });
  }
});
