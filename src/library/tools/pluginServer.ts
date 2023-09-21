import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { JsonProof } from 'o1js';
import { PluginType } from '../plugin/pluginType';
import { SimplePreimage } from '../../plugins/simplePreimage/plugin'
import SimplePasswordTree from '../../plugins/passwordTree/plugin'

const app = express();
const PORT = 3001;

interface EntryPoint {
    plugin: PluginType; // To be replaced with a base class
    verification_key: string | null;
}

const EntryPoints: Record<string, EntryPoint> = {
    SimplePreimage: {
        plugin: SimplePreimage,
        verification_key: null,
    },
    SimplePasswordTree: {
        plugin: SimplePasswordTree,
        verification_key: null,
    }
};

app.use(bodyParser.json());

async function compilePlugins(): Promise<void> {
    for (const [name, pluginObj] of Object.entries(EntryPoints)) {
        console.log('compiling ', name);
        const vk = await pluginObj.plugin.compile();
        EntryPoints[name].verification_key = vk;
    }
    console.log('compiled plugins', EntryPoints);
}

interface PrepareProofData {
    entrypoint: {
        name: string;
        config: unknown;
    };
    arguments: string[];
}

async function prepareProofFunction(
    data: PrepareProofData,
): Promise<JsonProof> {
    console.log('preparing proof for the input', data);
    const plugin_name = data.entrypoint.name;
    const entry = EntryPoints[plugin_name];
    if (!entry) throw `entrypoint/plugin ${plugin_name} not found`;
    console.log(`preparing proof for ${plugin_name}`);

    const plugin = entry.plugin;
    const jsonProof = await plugin.prove(data.arguments);
    if (!jsonProof) throw 'entrypoint/plugin ${plugin_name} unable to generate proof';
    return jsonProof;
}

interface VerifyProofData {
    entrypoint: {
        name: string;
        config: never;
    };
    proof: JsonProof;
}

async function verifyProofFunction(
    data: VerifyProofData,
): Promise<{ role: string | boolean | undefined; message: string }> {
    console.log('preparing proof for the input', data);
    const plugin_name = data.entrypoint.name;
    const entry = EntryPoints[plugin_name];
    if (!entry) throw `entrypoint/plugin ${plugin_name} not found`;
    console.log(`preparing proof for ${plugin_name}`);

    const plugin = entry.plugin;
    const proof: JsonProof = data.proof;
    const vk = entry.verification_key;
    if (!vk) throw `verification key not found for plugin ${plugin_name}`;

    const [role, msg] = await plugin.verify(proof, vk);
    return {
        role: role,
        message: msg,
    };
}

app.post('/buildProof', async (req: Request, res: Response) => {
    try {
        const result = await prepareProofFunction(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/verifyProof', async (req: Request, res: Response) => {
    try {
        const result = await verifyProofFunction(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, async () => {
    try {
        console.log('compiling plugins');
        await compilePlugins();
        console.log(`Server is running on http://localhost:${PORT}`);
    } catch (error) {
        console.error('Error during server initialization:', error);
        process.exit(1);
    }
});
