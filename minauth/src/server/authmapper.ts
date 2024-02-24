export interface IsAuthResponse {
  authStatus: 'full' | 'partial' | 'none';
  authMessage: string;
  serialized(): unknown;
}

export interface IAuthMapper<
  AuthResponse extends IsAuthResponse,
  AuthValidityReport
> {
  requestAuth(authRequestBody: unknown): Promise<AuthResponse>;
  checkAuthValidity(authResponse: AuthResponse): Promise<AuthValidityReport>;
}

export const mapValidityReport = <T extends IsAuthResponse, A, B>(
  authMapper: IAuthMapper<T, A>,
  f: (a: A) => Promise<B>
): IAuthMapper<T, B> => {
  return {
    requestAuth: authMapper.requestAuth,
    checkAuthValidity: (input: T): Promise<B> => {
      // Use the map method of the provided authMapper to get a Promise<A>,
      // then transform its resolved value into a Promise<B> using function f.
      return authMapper.checkAuthValidity(input).then(f);
    }
  };
};
