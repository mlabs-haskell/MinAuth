import { Field } from "o1js";
import { ClaimStruct, mkClaims } from "./claims.js";

describe('ClaimStruct', () => {
  it('should create a claim with the correct length and values', () => {
    const claimLength = 3;
    const claimValues = [new Field(1), new Field(2), new Field(3)];
    const Claim = ClaimStruct(claimLength);
    const claimInstance = new Claim(claimValues);

    expect(claimInstance.length.toBigInt()).toBe(BigInt(claimLength));
    expect(claimInstance.claimValue).toEqual(claimValues);
    expect(claimInstance.toFields()).toEqual([new Field(claimLength), ...claimValues]);
  });

  it('should throw an error for mismatched length and values', () => {
    const claimLength = 2;
    const claimValues = [new Field(1), new Field(2), new Field(3)]; // Intentional mismatch in lengths
    const Claim = ClaimStruct(claimLength);
    expect(() => new Claim(claimValues)).toThrow()
  });
});

describe('Claims', () => {
  it('should create Claims with correct structure', () => {

    const claim1 = new (ClaimStruct(1))([new Field(1)]);
    const claim2 = new (ClaimStruct(2))([new Field(21), new Field(22)]);
    const claims = [claim1, claim2];
    const claimsInstance = mkClaims(claims);

    expect(claimsInstance.count.toBigInt()).toBe(BigInt(2));

    const asNumbers = claimsInstance.toFields().map(f => Number(f.toBigInt()));

    const expected = [2, 0, 1, 3, 1, 21, 22];

    expect(asNumbers).toEqual(expected);
  });

  it('should retrieve correct claim data', () => {
    const claim1 = new (ClaimStruct(1))([new Field(1)]);
    const claim2 = new (ClaimStruct(2))([new Field(21), new Field(22)]);
    const claims = [claim1, claim2];
    const claimsInstance = mkClaims(claims);

    const claim1Retrieved = claimsInstance.getClaim(new Field(0), [new Field(1)]);
    const claim2Retrieved = claimsInstance.getClaim(new Field(1), [new Field(21), new Field(22)]);

    expect(claim1Retrieved).toHaveLength(1);
    expect(claim1Retrieved[0].toBigInt()).toBe(BigInt(1));
    expect(claim2Retrieved).toHaveLength(2);
    expect(claim2Retrieved[0].toBigInt()).toBe(BigInt(21));
    expect(claim2Retrieved[1].toBigInt()).toBe(BigInt(22));
  });
}
        );
