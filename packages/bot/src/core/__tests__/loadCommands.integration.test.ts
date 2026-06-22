import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCommands } from '../loadCommands.js';
import type { FakegamingBot } from '../../core/FakegamingBot.js';

const tempRoots: string[] = [];

async function createTempModulesRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), 'fg-load-commands-'));
    tempRoots.push(root);
    const commandsDir = path.join(root, 'modules', 'general', 'commands');
    await mkdir(commandsDir, { recursive: true });
    return path.join(root, 'modules');
}

async function writeCommand(modulesPath: string, fileName: string, body: string): Promise<void> {
    await writeFile(path.join(modulesPath, 'general', 'commands', fileName), body, 'utf8');
}

function createClient(): FakegamingBot {
    return {
        commands: new Map(),
    } as unknown as FakegamingBot;
}

describe('loadCommands integration', () => {
    afterEach(async () => {
        await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
    });

    it('registers real command modules and derives module metadata', async () => {
        const modulesPath = await createTempModulesRoot();
        await writeCommand(
            modulesPath,
            'alpha.js',
            `
export default {
    data: { name: 'alpha', description: 'Alpha from data' },
    execute: async () => undefined,
    autocomplete: async () => undefined,
    handleComponent: async () => false,
};
`
        );
        await writeCommand(
            modulesPath,
            'beta.js',
            `
export default {
    data: { name: 'beta', description: 'Beta from data' },
    description: 'Beta override',
    execute: async () => undefined,
};
`
        );
        await writeCommand(
            modulesPath,
            'gamma.js',
            `
export default {
    data: { name: 'gamma' },
    execute: async () => undefined,
};
`
        );
        await writeCommand(
            modulesPath,
            'invalid.js',
            `
export default {
    data: { name: 'invalid', description: 'No execute function' },
};
`
        );
        await writeFile(path.join(modulesPath, 'general', 'commands', 'ignored.md'), '# ignored', 'utf8');

        const client = createClient();

        await loadCommands(client, modulesPath);

        expect(Array.from(client.commands.keys()).sort()).toEqual(['alpha', 'beta', 'gamma']);
        expect(client.commands.get('alpha')).toEqual(expect.objectContaining({
            description: 'Alpha from data',
            moduleName: 'general',
            autocomplete: expect.any(Function),
            handleComponent: expect.any(Function),
        }));
        expect(client.commands.get('beta')).toEqual(expect.objectContaining({
            description: 'Beta override',
            moduleName: 'general',
        }));
        expect(client.commands.get('gamma')).toEqual(expect.objectContaining({
            description: undefined,
            moduleName: 'general',
        }));
    });

    it('returns without reading when the modules path does not exist', async () => {
        const client = createClient();

        await loadCommands(client, path.join(os.tmpdir(), 'fg-load-commands-missing'));

        expect(client.commands.size).toBe(0);
    });
});
