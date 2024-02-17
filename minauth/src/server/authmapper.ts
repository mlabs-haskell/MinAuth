export type AuthResponse = {
  verificationResult: VerificationResult;
  plugin: string;
  output: unknown;
};

/**
 * TODO: A result of a proof verification.
 */
type VerificationResult =
  | {
      __tag: 'success';
      output: unknown;
    }
  | {
      __tag: 'failed';
      error: string;
    };

// /**
//  * Forward proof verification to a remote verifier.
//  */
// const verifyProof = (
//   verifierUrl: string,
//   data: MinAuthProof,
//   log: Logger
// ): Promise<VerificationResult> => {
//   log.info('Calling for proof verification with:', data);
//   return axios.post(verifierUrl, data).then(
//     (resp) => {
//       if (resp.status == 200) {
//         log.info('Received response:', resp);
//         const { output } = resp.data as {
//           V
//         };
//         return { __tag: 'success', output };
//       }

//       const { error } = resp.data as { error: string };
//       return { __tag: 'failed', error };
//     },
//     (error) => {A
//       return { __tag: 'failed', error: String(error) };
//     }
//   );
// };

export default class AuthMapper {
  public static async initialize() {}

  public async requestAuth(authRequestBody: any): Promise<AuthResponse> {
    // This method will be used to request authentication from the plugin server.
    // It will send a request to the plugin server with the authentication request body
    // and return the response from the plugin server.
    return {
      verificationResult: { __tag: 'success', output: {} },
      plugin: 'string',
      output: {}
    };
  }
}
