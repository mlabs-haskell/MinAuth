import { JsonProof } from "o1js";
import { createHash } from "crypto";

export interface IProofCache {
  storeProof(publicInputArgs: any, proof: JsonProof):
    Promise</*The combined hash*/string>
  getProof(combinedHash: string):
    Promise<{
      publicInputArgs: any,
      proof: JsonProof
    }>
  invalidateProof(combinedHash: string):
    Promise<void>;
  checkEach(f: (publicInputArgs: any, proof: JsonProof)
    => Promise<boolean>): Promise<void>
}

export interface IProofCacheProvider {
  getCacheOf(plugin: string): Promise<IProofCache>;
}

export class InMemoryProofCache implements IProofCacheProvider {
  store: Map<string, Map<string, {
    publicInputArgs: any,
    proof: JsonProof
  }>> = new Map();

  async getCacheOf(plugin: string): Promise<IProofCache> {
    if (!this.store.has(plugin))
      this.store.set(plugin, new Map());

    const store = this.store;
    const scopedStore = this.store.get(plugin)!;

    async function storeProof(
      publicInputArgs: any,
      proof: JsonProof): Promise<string> {
      const combinedHash =
        createHash('sha256')
          .update(JSON.stringify({ publicInputArgs, proof }))
          .digest('hex');
      if (scopedStore.has(combinedHash))
        throw "cannot replace existing entry";
      scopedStore.set(combinedHash, { publicInputArgs, proof });
      return combinedHash;
    }

    async function getProof(combinedHash: string):
      Promise<{
        publicInputArgs: any,
        proof: JsonProof
      }> {
      const ret = scopedStore.get(combinedHash);
      if (!ret) throw "entry not found";
      return ret;
    }

    async function invalidateProof(combinedHash: string):
      Promise<void> {
      scopedStore.delete(combinedHash);
    }

    async function checkEach(f: (publicInputArgs: any, proof: JsonProof)
      => Promise<boolean>): Promise<void> {
      const filtered = new Map<string, {
        publicInputArgs: any,
        proof: JsonProof
      }>();

      scopedStore.forEach(async ({ publicInputArgs, proof }, k) => {
        if (await f(publicInputArgs, proof)) {
          filtered.set(k, { publicInputArgs, proof });
        }
      });

      store.set(plugin, filtered);
    }

    return {
      storeProof, getProof, invalidateProof, checkEach
    }
  }
}