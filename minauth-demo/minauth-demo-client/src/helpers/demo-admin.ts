/**
 * This module contains function to help with making requests to the server.
 * The requests here are for demonstation purposes only and usually the server
 * will not be accepting these from the client directly.
 * They are meant as admin actions to configure the plugins on the server.
 */
import { z } from 'zod';
import { ApiResponse, mkRequest } from './request';
import { ServerConfig } from '@/api/server-config';

const getRolesURL = `${ServerConfig.url}/plugins/simple-preimage/admin/roles`;
const postRolesURL = `${ServerConfig.url}/plugins/simple-preimage/admin/roles`;

export const SimplePreimageRolesSchema = z.record(z.string(), z.string());
export type SimplePreimageRoles = z.infer<typeof SimplePreimageRolesSchema>;

export type SimplePreimageRolesResponse = ApiResponse<
  typeof SimplePreimageRolesSchema
>;

export const simplePreimageGetRoles =
  async (): Promise<SimplePreimageRolesResponse> => {
    const resp = await mkRequest(getRolesURL, SimplePreimageRolesSchema);
    return resp;
  };

export const simplePreimageSetRoles = async (
  roles: Record<string, string>
): Promise<ApiResponse<z.ZodUnknown>> => {
  const resp = await mkRequest(postRolesURL, z.unknown(), {
    body: roles
  });
  return resp;
};
