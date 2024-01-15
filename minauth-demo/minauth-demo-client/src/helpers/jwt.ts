import { z } from 'zod';
import { ApiResponse, ApiResponseSchema, mkRequest } from './request';
import { MinAuthProof } from 'minauth/dist/common/proof';
import { ServerConfig } from '@/api/server-config';

const submitURL = `${ServerConfig.url}/login`;
const refreshURL = `${ServerConfig.url}/token`;

export const AuthSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  message: z.string()
});

// export const RefreshSchema = z.object({
export const RefreshSchema = z.object({
  token: z.string()
});

export type AuthData = z.infer<typeof AuthSchema>;
export type AuthResponse = ApiResponse<typeof AuthSchema>;
export type RefreshResponse = ApiResponse<typeof RefreshSchema>;

export const getAuth = async (submissionData: MinAuthProof) => {
  const res = await mkRequest(submitURL, AuthSchema, { body: submissionData });
  return res;
};

export const parseAuthData = (
  response: ApiResponse<typeof AuthSchema>
): AuthData | null => {
  if (response.type === 'ok') {
    const result = AuthSchema.safeParse(response.data);
    if (result.success) {
      return result.data;
    }
  }
  return null;
};

export const mkAuthorizedRequest = async (
  url: string,
  auth: AuthData,
  props?: { body?: unknown }
): Promise<ApiResponse<z.ZodTypeAny>> => {
  const headers = {
    Authorization: `Bearer ${auth.token}`
  };

  return await mkRequest(
    url,
    z.unknown(),
    props?.body ? { headers, body: props?.body } : { headers }
  );
};

export const refreshAuth = async (auth: AuthData): Promise<AuthResponse> => {
  const schema = ApiResponseSchema(RefreshSchema);
  const resp = await mkAuthorizedRequest(refreshURL, auth, { body: auth });
  const parsed: RefreshResponse = schema.parse(resp);
  if (parsed.type !== 'ok') {
    return parsed;
  }
  // rebuild authdata with the new token.
  return { ...parsed, data: { ...auth, token: parsed.data.token } };
};
