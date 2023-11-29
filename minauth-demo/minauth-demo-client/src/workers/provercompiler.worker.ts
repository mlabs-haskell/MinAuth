/// <reference lib="webworker" />
import {
  ProverCompilationResult,
  ProverZkCircuit
} from './provercompilertypes';
// import { SimplePreimageProver } from 'minauth-simple-preimage-plugin/prover';
// import { MembershipsProver } from 'minauth-merkle-membership-plugin/prover';
// import { launchTE } from 'minauth/utils/fp/taskeither';
import { wrapProverOnMessage } from '@/app/typedworker';

declare const self: DedicatedWorkerGlobalScope;
export {};

const postResult = (result: ProverCompilationResult) => {
  console.log('Worker output:', result);
  postMessage(JSON.stringify(result));
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function compileSimplePreimageProver() {
  await sleep(3000); // 3-second delay
  const result: { verificationKey: string } = { verificationKey: '' };
  // await SimplePreimageProver.compile();
  return result;
}

onmessage = wrapProverOnMessage(
  async (event: MessageEvent<ProverZkCircuit>) => {
    try {
      console.log('Message received from main script', event.data);
      postResult({ status: 'processing' });

      const message = event.data;

      console.log('message.type', message.type);
      let result: { verificationKey: string } = { verificationKey: '' };
      switch (message.type) {
        case 'SimplePreimage':
          console.log('Compiling SimplePreimageProver');
          result = await compileSimplePreimageProver();
          postResult({ status: 'success', result });
          break;
      }
    } catch (e) {
      postResult({
        status: 'error',
        error: { message: 'Unknown error in web worker', error: e }
      });
    }
  }
);

// switch (message.type) {
//   case 'SimplePreimage':
//     console.log('Compiling SimplePreimageProver');
//     //     try {
//     //   console.log('Compiling SimplePreimageProver');
//     //   // const result: { verificationKey: string } =
//     //   //   await SimplePreimageProver.compile();
//     //   // throw new Error('Not implemented');
//     //   // postResult({ status: 'success', result });
//     // } catch (e) {
//     //   // postResult({
//     //   //   status: 'error',
//     //   //   error: {
//     //   //     message: 'Error during SimplePreimageProver compilation',
//     //   //     error: e
//     //   //   }
//     //   // });
//     // }
//     break;
//   case 'MerkleMemberships':
//     try {
//       const result = await launchTE(MembershipsProver.compile());
//       postResult({ status: 'success', result });
//     } catch (e) {
//       postResult({
//         status: 'error',
//         error: {
//           message: 'Error during SimplePreimageProver compilation',
//           error: e
//         }
//       });
//     }
//     break;
//   default: {
//     postResult({
//       status: 'error',
//       error: { message: 'Unknown prover zk circuit' }
//     });
//   }
// }
