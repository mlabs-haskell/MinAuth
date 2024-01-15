import { AuthData, mkAuthorizedRequest } from '@/helpers/jwt';
import { ApiResponse } from '@/helpers/request';
import { z } from 'zod';
import { ServerConfig } from './server-config';

const resourceUrl = `${ServerConfig.url}/protected`;

export const requestProtectedResource = async (
  auth: AuthData
): Promise<ApiResponse<z.ZodUnknown>> => {
  return await mkAuthorizedRequest(resourceUrl, auth);
};
