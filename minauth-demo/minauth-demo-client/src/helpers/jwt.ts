import { z } from 'zod';
import {
  ApiResponse,
  ApiResponseSchema,
  mkRequest
} from 'minauth/dist/common/request.js';
import { ServerConfig } from '@/api/server-config';
import { MinAuthProof } from 'minauth/dist/common/proof';

const submitURL = `${ServerConfig.url}/login`;
const refreshURL = `${ServerConfig.url}/token`;

// this is based on a plugintorolemapper - an authmapper used by the server
export const AuthReqSchema = z.record(
  z.string(), // plugin name
  z.unknown() // plugin-specific input
);

export type AuthReq = z.infer<typeof AuthReqSchema>;

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
  const authReq: AuthReq = { [submissionData.plugin]: submissionData.input };
  const res = await mkRequest(submitURL, AuthSchema, { body: authReq });
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
