import { MinAuthProof } from '@lib/server/minauthStrategy';
import axios from 'axios';
import path from 'path';
import * as z from 'zod';

export const loginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string()
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({ token: z.string() });

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const accessProtectedResponseSchema = z.object({ message: z.string() });

export type AccessProtectedResponse = z.infer<
  typeof accessProtectedResponseSchema
>;

export interface ProofGeneratorFactory<Conf> {
  mkGenerator(conf: Conf): () => Promise<MinAuthProof>;

  readonly confSchema: z.Schema<Conf>;
}

export class Client {
  readonly serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  mkUrl(...pathComponents: string[]): string {
    return new URL(path.join(...pathComponents), this.serverUrl).href;
  }

  async login(proof: MinAuthProof): Promise<LoginResponse> {
    const resp = await axios.post(this.mkUrl('login'), proof);
    if (resp.status !== 200) throw 'failed to login';
    return loginResponseSchema.parse(resp.data);
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    const resp = await axios.post(this.mkUrl('token'), {
      refreshToken
    });
    if (resp.status !== 200) throw 'failed to refresh jwt token';
    return refreshResponseSchema.parse(resp.data);
  }

  async accessProtected(
    jwtToken: string,
    protectedPath: string = '/protected'
  ): Promise<AccessProtectedResponse> {
    const resp = await axios.get(this.mkUrl(protectedPath), {
      headers: {
        Authorization: `Bearer ${jwtToken}`
      }
    });
    if (resp.status !== 200) throw 'failed to access protected route';
    return accessProtectedResponseSchema.parse(resp.data);
  }
}
