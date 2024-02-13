import { z } from 'zod';

/**
 * A zod schema against which o1js JsonProof objects can be validated.
 */
export const JsonProofSchema = z.object({
  publicInput: z.array(z.string()),
  publicOutput: z.array(z.string()),
  maxProofsVerified: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  proof: z.string()
});

/**
 * A zod schema for proof objects that can be verified by the plugin server.
 */
export const MinAuthPluginInputSchema = z.object({
  plugin: z.string(),
  input: z.unknown()
});

/**
 * A type for proof objects that can be verified by the plugin server.
 */
export type MinAuthProof = z.infer<typeof MinAuthPluginInputSchema>;
