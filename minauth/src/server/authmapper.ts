import { EncodeDecoder, fpToTsEncDec } from '../plugin/encodedecoder.js';
import {
  FpInterfaceType,
  InterfaceKind,
  RetType,
  TsInterfaceType,
  WithInterfaceTag
} from '../plugin/interfacekind.js';
import { toFailablePromise } from './pluginhost.js';

/**
 * Defines the structure for an authentication mapper, responsible for handling
 * authentication processes, including requesting authentication, validating responses,
 * and extracting information necessary for validity checks.
 *
 * @template AuthRequest The type for data for requesting authentication.
 * @template AuthResponse The type of the authentication response.
 * @template AuthResponseValidityCheck The type used for checking the validity of an auth response.
 * @template AuthValidityReport The type representing the outcome of the validity check.
 */
export interface IAuthMapper<
  InterfaceType extends InterfaceKind,
  AuthRequest,
  AuthResponse,
  AuthResponseValidityCheck,
  AuthValidityReport
> extends WithInterfaceTag<InterfaceType> {
  /**
   * Asynchronously requests authentication based on the provided request body.
   * @param authRequestBody The request body for the authentication request.
   * @returns A promise resolving to an `AuthResponse`.
   */
  requestAuth(
    authRequestBody: AuthRequest
  ): RetType<InterfaceType, AuthResponse>;

  /**
   * Asynchronously checks the validity of an authentication response.
   * @param authResponse The response to validate.
   * @returns A promise resolving to an `AuthValidityReport`.
   */
  checkAuthValidity(
    authResponse: AuthResponseValidityCheck
  ): RetType<InterfaceType, AuthValidityReport>;

  /**
   * Extracts necessary information from an `AuthResponse` to perform a validity check.
   * @param authResponse The authentication response.
   * @returns The extracted information necessary for the validity check.
   */
  extractValidityCheck(authResponse: AuthResponse): AuthResponseValidityCheck;

  /**
   * Provide an encoder/decoder for the authentication response.
   * Use it to make sure that it is in a serializable format
   */
  readonly authRequestEncDecoder: EncodeDecoder<InterfaceType, AuthRequest>;

  /**
   * Provide an encoder/decoder for the authentication response.
   * Use it to make sure that it is in a serializable format
   */
  readonly authResponseEncDecoder: EncodeDecoder<InterfaceType, AuthResponse>;
}

/**
 * Transforms the result of the `checkAuthValidity` method of an `IAuthMapper` instance,
 * allowing for the transformation of the validity report into a new type.
 *
 * @template Resp The type of the authentication response, extending `IsAuthResponse`.
 * @template A The original type of the validity report generated by `checkAuthValidity`.
 * @template V The type of the input to `checkAuthValidity`.
 * @template B The new type for the validity report after transformation.
 * @param authMapper An instance of `IAuthMapper`.
 * @param f A function that transforms a value of type `A` into a `Promise<B>`.
 * @returns An `IAuthMapper` instance with transformed `checkAuthValidity` output.
 */
export const mapValidityReport = <Req, Resp, A, V, B>(
  authMapper: IAuthMapper<TsInterfaceType, Req, Resp, V, A>,
  f: (a: A) => Promise<B>
): IAuthMapper<TsInterfaceType, Req, Resp, V, B> => {
  return {
    __interface_tag: 'ts',
    extractValidityCheck: authMapper.extractValidityCheck,
    requestAuth: authMapper.requestAuth,
    authRequestEncDecoder: authMapper.authRequestEncDecoder,
    authResponseEncDecoder: authMapper.authResponseEncDecoder,
    checkAuthValidity: (input: V): Promise<B> => {
      return authMapper.checkAuthValidity(input).then(f);
    }
  };
};

export const fpToTsAuthMapper = <Req, Resp, V, A>(
  authMapper: IAuthMapper<FpInterfaceType, Req, Resp, V, A>
): IAuthMapper<TsInterfaceType, Req, Resp, V, A> => {
  return {
    __interface_tag: 'ts',
    extractValidityCheck: authMapper.extractValidityCheck,
    requestAuth: (x) => toFailablePromise(authMapper.requestAuth(x)),
    authRequestEncDecoder: fpToTsEncDec(authMapper.authRequestEncDecoder),
    authResponseEncDecoder: fpToTsEncDec(authMapper.authResponseEncDecoder),
    checkAuthValidity: (x) => toFailablePromise(authMapper.checkAuthValidity(x))
  };
};
