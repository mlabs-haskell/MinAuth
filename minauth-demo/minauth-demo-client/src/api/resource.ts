import { AuthData, mkAuthorizedRequest } from '@/helpers/jwt';
import { z } from 'zod';
import { ServerConfig } from './server-config';
import { ApiResponse } from 'minauth/dist/common/request.js';

const resourceUrl = `${ServerConfig.url}/protected`;

export const requestProtectedResource = async (
  auth: AuthData
): Promise<ApiResponse<z.ZodUnknown>> => {
  return await mkAuthorizedRequest(resourceUrl, auth);
};
