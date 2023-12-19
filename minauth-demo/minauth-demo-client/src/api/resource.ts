import { AuthResponse, mkAuthorizedRequestGet } from '@/helpers/jwt';

const resourceUrl = 'http://127.0.0.1:3000/protected';

export const requestProtectedResource = async (auth: AuthResponse) => {
  return await mkAuthorizedRequestGet(resourceUrl, auth);
};
