import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JsonProof, verify } from 'o1js';
import { IMinAuthPlugin } from 'plugin/pluginType';
import { readConfigurations, untypedPlugins } from './config';
import { InMemoryProofCache } from './cachedProof';

const configurations = readConfigurations();
const proofCache = new InMemoryProofCache(); // TODO: redis backend

/**
 * Construct plugins which are enabled in the configuration.
 * @returns A record of plugin instances.
 */
async function initializePlugins():
  Promise<Record<string, IMinAuthPlugin<any, any>>> {
  console.log('compiling plugins');
  return Object
    .entries(configurations.plugins)
    .reduce(async (o, [name, cfg]) => {
      const factory = untypedPlugins[name];
      const scopedCache = await proofCache.getCacheOf(name);
      const plugin = await factory.initialize(cfg, scopedCache.checkEach);
      return { ...o, [name]: plugin };
    }, {});
}

initializePlugins()
  .then((activePlugins) => {
    // The type of `POST /verifyProof` requests' body.
    interface VerifyProofData {
      plugin: string;
      publicInputArgs: any;
      proof: JsonProof;
    }

    interface VerifyCachedProofData {
      plugin: string;
      combinedHash: string;
    }

    // Use the appropriate plugin to verify the proof and return the output.
    async function verifyProof(data: VerifyProofData): Promise<{
      output: any
      combinedHash: string
    }> {
      const pluginName = data.plugin;
      console.info(`verifying proof using plugin ${pluginName}`);
      const pluginInstance = activePlugins[pluginName];
      if (!pluginInstance)
        throw `plugin ${pluginName} not found`;
      // Step 1: check that the proof was generated using a certain verification key.
      const proofValid = await verify(data.proof, pluginInstance.verificationKey);
      if (!proofValid)
        throw `invalid proof`;
      // Step 2: use the plugin to extract the output. The plugin is also responsible
      // for checking the legitimacy of the public inputs.
      const typedPublicInputArgs
        = pluginInstance.publicInputArgsSchema.parse(data.publicInputArgs);
      const output =
        await pluginInstance.verifyAndGetOutput(typedPublicInputArgs, data.proof);
      // Step 3: cache the proof.
      const scopedCache = await proofCache.getCacheOf(pluginName);
      const combinedHash = await scopedCache.storeProof(data.publicInputArgs, data.proof);
      return { output, combinedHash };
    }

    async function verifyCachedProof(data: VerifyCachedProofData): Promise<void> {
      const pluginName = data.plugin;
      const plugin = activePlugins[pluginName];
      if (!plugin)
        throw `plugin ${pluginName} not active`;
      const scopedCache = await proofCache.getCacheOf(data.plugin);
      const { publicInputArgs, proof } = await scopedCache.getProof(data.combinedHash);
      await plugin.verifyAndGetOutput(publicInputArgs, proof);
    }

    const app = express().use(bodyParser.json());

    // Register all custom routes of active plugins under `/plugins/${pluginName}`.
    Object.entries(activePlugins).map(([name, plugin]) =>
      Object
        .entries(plugin.customRoutes)
        .map(([path, handler]) =>
          app.use(`/plugins/${name}/${path}`, handler)
        )
    );

    app
      .post('/verifyProof', async (req: Request, res: Response) => {
        try {
          const result = await verifyProof(req.body);
          res.json({ result });
        } catch (error) {
          console.error('Error:', error);
          res
            .status(500)
            .json({ error: 'Internal Server Error' });
        }
      })
      .post('/verifyCachedProof', async (req: Request, res: Response) => {
        try {
          await verifyCachedProof(req.body);
          res.status(200);
        } catch {
          res.status(400).json({ error: "unable to validate proof" });
        }
      })
      .listen(
        configurations.server.port,
        configurations.server.address,
        () =>
          console.log(`Server is running on http://localhost:${configurations.server.port}`)
      );
  })
  .catch((error) => {
    console.error('Error during server initialization:', error);
    process.exit(1);
  });