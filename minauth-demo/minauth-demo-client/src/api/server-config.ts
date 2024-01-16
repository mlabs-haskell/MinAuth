import * as z from 'zod';

export const ServerConfigSchema = z.object({
  url: z.string().default('http://127.0.0.1:3000')
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const ServerConfig: ServerConfig = ServerConfigSchema.parse({
  url: 'http://127.0.0.1:3000'
});
