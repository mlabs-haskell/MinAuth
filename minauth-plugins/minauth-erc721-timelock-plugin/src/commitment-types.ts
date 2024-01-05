import { Character, CircuitString, Field, Poseidon } from 'o1js';

export type UserSecretInput = { secret: string };
export type UserSecret = { secretHash: Field };
export type UserCommitmentHex = { commitmentHex: string };
export type UserCommitmentField = { commitment: Field };

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
  return { commitmentHex: hex(commitment.toString()) };
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
  return { commitmentHex: hex(commitment.toString()) };
};

export const hex = (decimalStr: string): string => {
  const decimalInt = BigInt(decimalStr);
  return '0x' + decimalInt.toString(16);
};
