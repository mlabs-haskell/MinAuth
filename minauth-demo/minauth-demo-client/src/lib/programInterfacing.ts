import { Field } from 'o1js';
import { MerkleRoot } from './merkleMembershipProgram';
import SimpleSchema from 'simpl-schema';

// =========================== SCHEMA AND FORM =============================

export async function getProofBuilderMetadata() {
  // Fetch or acquire the metadata from the proof builder.
  // This is a mocked example:
  return {
    schema: new SimpleSchema({
      username: { type: String, required: true },
      password: { type: String, required: true }
    })
  };
}

// =========================== ZK PROGRAM =============================

export const testMerkleRoot = new MerkleRoot({ root: new Field(1) });
