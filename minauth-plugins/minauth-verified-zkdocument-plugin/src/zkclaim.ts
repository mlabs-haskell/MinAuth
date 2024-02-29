import { z } from "zod";

export const ZkClaimSubpluginSchema = z.object({
  zkClaimProgramVerificationKeyHash: z.string(),
})

export type ZkClaimSubplugin = z.infer<typeof ZkClaimSubpluginSchema>;

// ZkClaim should be able to
// - communicate to the user what is being claimed
// - communicate the need of auditional context to check the validity of the claim, e.g. current time (actually this might be something that should not be a part of claims)

