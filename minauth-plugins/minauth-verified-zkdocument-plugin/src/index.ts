import { Field, PrivateKey, verify } from "o1js";

const p = PrivateKey.random();

const pk = p.toPublicKey();


const pkf = pk.toFields();


console.log(pkf.length);
