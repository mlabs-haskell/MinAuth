import { JsonProof } from 'o1js';
import z from 'zod';

export const ProverMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.object({
    general: z.string(),
    secret_input: z.string(),
    public_input: z.string()
  })
});
export type ProverMetadata = z.infer<typeof ProverMetadataSchema>;

export const PublicInputListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string()
  })
);
export type PublicInputList = z.infer<typeof PublicInputListSchema>;

// Interfaces used on the client side.
export interface IMinAuthProver<PublicInputArgs, PublicInput, SecretInput> {
  prove(publicInput: PublicInput, secretInput: SecretInput): Promise<JsonProof>;

  fetchPublicInputs(args: PublicInputArgs): Promise<PublicInput>;
}

export interface IMinAuthProverFactory<
  T extends IMinAuthProver<PublicInputArgs, PublicInput, SecretInput>,
  Configuration,
  PublicInputArgs,
  PublicInput,
  SecretInput
> {
  initialize(cfg: Configuration): Promise<T>;
}
