import { z } from 'zod';
import { mkRequest } from './request';
import { MinAuthProof } from 'minauth/dist/common/proof';

const submitURL = 'http://127.0.0.1:3000/login';

export const AuthSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  message: z.string()
});

export type AuthResponse = z.infer<typeof AuthSchema>;

export const getAuth = async (submissionData: MinAuthProof) => {
  const res = await mkRequest(submitURL, AuthSchema, { body: submissionData });
  return res;
};

export const parseAuthResponse = (response: unknown): AuthResponse | null => {
  const result = AuthSchema.safeParse(response);
  if (result.success) {
    return result.data;
  }
  return null;
};

export const mkAuthorizedRequestGet = async (
  url: string,
  auth: AuthResponse
) => {
  const headers = {
    Authorization: `Bearer ${auth.token}`
  };

  return await mkRequest(url, z.unknown(), { headers });
};
