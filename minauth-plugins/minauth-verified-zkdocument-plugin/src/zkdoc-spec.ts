import * as z from 'zod';

export const ZkDocPartSpecSchema = z.object(
  { partName: z.string()
  , partLocation: z.object({first: z.number(), last: z.number()})
  , humanDescription: z.string()
  , endorsedZkClaimProgramVerificationKeyHashes: z.array(z.string())
});

export type ZkDocPartSpec = z.infer<typeof ZkDocPartSpecSchema>;

const zkDocSpecSchema = z.object(
  { title: z.string()
  , description: z.string()
  , parts: z.array(ZkDocPartSpecSchema)
  });

export type ZkDocSpec = z.infer<typeof zkDocSpecSchema>;
