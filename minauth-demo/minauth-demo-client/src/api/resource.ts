import { AuthData, mkAuthorizedRequest } from '@/helpers/jwt';
import { ApiResponse } from '@/helpers/request';
import { z } from 'zod';

const resourceUrl = 'http://127.0.0.1:3000/protected';

export const requestProtectedResource = async (
  auth: AuthData
): Promise<ApiResponse<z.ZodUnknown>> => {
  return await mkAuthorizedRequest(resourceUrl, auth);
};
