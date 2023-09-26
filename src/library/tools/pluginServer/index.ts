import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JsonProof, verify } from 'o1js';
import { IMinAuthPlugin } from 'plugin/pluginType';
import { readConfigurations, untypedPlugins } from './config';

const configurations = readConfigurations();

async function initializePlugins():
  Promise<Record<string, IMinAuthPlugin<any, any>>> {
  console.log('compiling plugins');
  return Object
    .entries(configurations.plugins)
    .reduce(async (o, [name, cfg]) => {
      const factory = untypedPlugins[name];
      const plugin = await factory.initialize(cfg);
      return { ...o, [name]: plugin };
    }, {});
}

initializePlugins()
  .then((activePlugins) => {
    interface VerifyProofData {
      plugin: string;
      publicInputArgs: any;
      proof: JsonProof;
    }

    async function verifyProof(data: VerifyProofData): Promise<any> {
      const pluginName = data.plugin;
      console.info(`verifying proof using plugin ${pluginName}`);
      const pluginInstance = activePlugins[pluginName];
      if (!pluginInstance)
        throw `plugin ${pluginName} not found`;
      const proofValid = await verify(data.proof, pluginInstance.verificationKey);
      if (!proofValid)
        throw `invalid proof`;
      const typedPublicInputArgs
        = pluginInstance.publicInputArgsSchema.parse(data.publicInputArgs);
      const output =
        await pluginInstance.verifyAndGetOutput(typedPublicInputArgs, data.proof);
      if (!output)
        throw `plugin ${pluginName} failed to verify the proof`;
      return output;
    }

    const app = express().use(bodyParser.json());

    Object.entries(activePlugins).map(([name, plugin]) =>
      Object
        .entries(plugin.customRoutes)
        .map(([path, handler]) =>
          app.use(`plugins/${name}/${path}`, handler)
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
      .listen(configurations.server.port,
        () =>
          console.log(`Server is running on http://localhost:${configurations.server.port}`)
      );
  })
  .catch((error) => {
    console.error('Error during server initialization:', error);
    process.exit(1);
  });