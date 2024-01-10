import { Character, CircuitString, Field, Poseidon } from 'o1js';
import * as z from 'zod';

export const UserCommitmentHexSchema = z.object({
  commitmentHex: z.string().regex(/^(0x)?[0-9a-fA-F]+$/, {
    message: 'Invalid hexadecimal string'
  })
});

export const UserSecretInputSchema = z.object({
  secret: z.string().max(CircuitString.maxLength)
});

export const UserCommitmentFieldSchema = z.object({
  commitment: z.instanceof(Field, {
    message: 'Invalid commitment type. Should be o1js.Field.'
  })
});

export const UserSecretSchema = z.object({
  secretHash: z.instanceof(Field, {
    message: 'Invalid secret hash type. Should be o1js.Field.'
  })
});

export type UserSecretInput = z.infer<typeof UserSecretInputSchema>;
export type UserSecret = z.infer<typeof UserSecretSchema>;
export type UserCommitmentHex = z.infer<typeof UserCommitmentHexSchema>;
export type UserCommitmentField = z.infer<typeof UserCommitmentFieldSchema>;

export const SECRET_MAX_LENGTH = CircuitString.maxLength;

export const mkUserSecret = ({ secret }: UserSecretInput): UserSecret => {
  if (secret.length > CircuitString.maxLength) {
    throw new Error(
      `Secret string length is ${secret.length} but max length is ${CircuitString.maxLength}`
    );
  }
  const secretCircuitString = CircuitString.fromString(secret);
  const fields = secretCircuitString.values.map((c: Character) => c.value);
  return { secretHash: Poseidon.hash(fields) };
};

export const userCommitmentHex = ({
  secretHash
}: UserSecret): UserCommitmentHex => {
  const commitment = Poseidon.hash([secretHash]);
  return { commitmentHex: hexField(commitment) };
};

export const userCommitmentField = ({
  secretHash
}: UserSecret): UserCommitmentField => {
  const commitment = Poseidon.hash([secretHash]);
  return { commitment };
};

export const commitmentHexToField = ({
  commitmentHex
}: UserCommitmentHex): UserCommitmentField => {
  let commitment = commitmentHex;
  // Ensure the commitment string starts with '0x'
  if (!commitment.startsWith('0x')) {
    commitment = '0x' + commitment;
  }
  const ret = new Field(BigInt(commitment));
  return { commitment: ret };
};

export const commitmentFieldToHex = ({
  commitment
}: UserCommitmentField): UserCommitmentHex => {
  return { commitmentHex: hexField(commitment) };
};

export const hexField = (f: Field): string => {
  const decimalInt = BigInt(f.toString());
  let hex = decimalInt.toString(16);
  if (hex.length % 2) {
    hex = '0' + hex;
  }
  return '0x' + hex;
};
