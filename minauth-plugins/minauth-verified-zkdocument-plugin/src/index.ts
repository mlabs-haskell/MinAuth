import { Field, verify } from "o1js";
import { FakeP1, P1, VerifyProgram } from "./zkclaims/VCredProof.js";


console.log("compiling p1");
const p1vk = await P1.compile();
console.log("compiling fakep1");
const fakeP1vk = await FakeP1.compile();
console.log("compiling verifyProgram");
const verifyProgramVk = await VerifyProgram.compile();

// compare behabiour of VerifyProgram with FakeP1 and P1

console.log("create a proof for P1");
const p1 = await P1.someMethod(new Field("123"));

// create a proof for P1

console.log("create a proof for FakeP1");
const fakeP1 = await FakeP1.someMethod(new Field("123"));


console.log("create a proof for verifyP1");
const vp1 = await VerifyProgram.someMethod(new Field("123"));

console.log("create a recursive proof for VerifyProgram");
let proof
try{
proof = await VerifyProgram.verifyP1(new Field(0), p1)
  console.log("created a proof for VerifyProgram with P1")

  console.log("verify the proof for VerifyProgram");
  await verify(proof, verifyProgramVk.verificationKey);
} catch (e) {
  console.log("cannot create a proof for VerifyProgram with P1")
  console.log(e)
}

try{
  proof = await VerifyProgram.verifyP1(new Field(0), vp1)
  console.log("created a proof for VerifyProgram with VP1")
  console.log("verify the proof for VerifyProgram");
  await verify(proof, verifyProgramVk.verificationKey);
} catch (e) {
  console.log("cannot create a proof for VerifyProgram with VP1")
  console.log(e)
}
