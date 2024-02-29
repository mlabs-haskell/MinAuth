import { z } from "zod";

export const ZkClaimSubpluginSchema = z.object({
  zkClaimProgramVerificationKeyHash: z.string(),
})

export type ZkClaimSubplugin = z.infer<typeof ZkClaimSubpluginSchema>;
