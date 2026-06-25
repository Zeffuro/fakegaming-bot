import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    deployCommands,
    hashCommands,
    resolveCommandDeployConfig,
    type CommandSet,
} from '../deploy-commands.js';

const tempDirs: string[] = [];

const commandSets: CommandSet = {
    globalCommands: [
        {
            name: 'alpha',
            description: 'Alpha command',
            options: [{ name: 'query', description: 'Search query', type: 3 }],
        },
    ],
    guildCommands: [
        {
            name: 'alpha',
            description: 'Alpha command',
            options: [{ name: 'query', description: 'Search query', type: 3 }],
        },
        {
            name: 'beta',
            description: 'Beta test command',
        },
    ],
};

function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return {
        NODE_ENV: 'production',
        COMMAND_DEPLOY_MODE: 'auto',
        COMMAND_DEPLOY_SCOPE: 'global',
        CLIENT_ID: 'client-1',
        DISCORD_BOT_TOKEN: 'Token.Value.KeepsCase',
        ...overrides,
    };
}

function createRest(existing: unknown = []) {
    return {
        get: vi.fn(async (_route: string) => existing),
        put: vi.fn(async (_route: string, options: { body: object[] }) => options.body),
    };
}

async function makeStatePath(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fg-command-deploy-'));
    tempDirs.push(dir);
    return path.join(dir, 'command-deploy-state.json');
}

async function writeState(statePath: string, key: string, hash: string): Promise<void> {
    await writeFile(
        statePath,
        JSON.stringify({
            deployments: {
                [key]: {
                    hash,
                    updatedAt: '2026-06-25T00:00:00.000Z',
                },
            },
        }),
        'utf8'
    );
}

describe('command deployment policy', () => {
    afterEach(async () => {
        await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
        vi.clearAllMocks();
    });

    it('defaults to auto global deployment in production', () => {
        expect(resolveCommandDeployConfig(baseEnv({ COMMAND_DEPLOY_MODE: undefined, COMMAND_DEPLOY_SCOPE: undefined }))).toEqual({
            mode: 'auto',
            scope: 'global',
            clientId: 'client-1',
            guildId: undefined,
        });
    });

    it('defaults to always guild deployment in development when a guild id is configured', () => {
        expect(resolveCommandDeployConfig(baseEnv({
            COMMAND_DEPLOY_MODE: undefined,
            COMMAND_DEPLOY_SCOPE: undefined,
            GUILD_ID: 'guild-1',
            NODE_ENV: 'development',
        }))).toEqual({
            mode: 'always',
            scope: 'guild',
            clientId: 'client-1',
            guildId: 'guild-1',
        });
    });

    it('hashes stable command payloads without volatile Discord fields', () => {
        const left = hashCommands([{ name: 'alpha', description: 'Alpha', id: '1', version: 'old' }]);
        const right = hashCommands([{ name: 'alpha', description: 'Alpha', id: '2', version: 'new' }]);

        expect(left).toBe(right);
    });

    it('treats missing command type as chat input while preserving context command type changes', () => {
        const implicitChatInput = hashCommands([{ name: 'alpha', description: 'Alpha' }]);
        const explicitChatInput = hashCommands([{ name: 'alpha', description: 'Alpha', type: 1 }]);
        const userContext = hashCommands([{ name: 'alpha', description: 'Alpha', type: 2 }]);

        expect(implicitChatInput).toBe(explicitChatInput);
        expect(userContext).not.toBe(implicitChatInput);
    });

    it('skips deployment entirely when mode is never', async () => {
        const rest = createRest();
        const result = await deployCommands({
            commandSets,
            env: baseEnv({
                CLIENT_ID: undefined,
                COMMAND_DEPLOY_MODE: 'never',
                DISCORD_BOT_TOKEN: undefined,
            }),
            rest,
            statePath: await makeStatePath(),
        });

        expect(result).toEqual({
            mode: 'never',
            scope: 'global',
            targets: [],
        });
        expect(rest.get).not.toHaveBeenCalled();
        expect(rest.put).not.toHaveBeenCalled();
    });

    it('skips Discord calls in auto mode when the saved manifest hash matches', async () => {
        const statePath = await makeStatePath();
        const hash = hashCommands(commandSets.globalCommands);
        await writeState(statePath, 'global:client-1', hash);

        const rest = createRest();
        const result = await deployCommands({
            commandSets,
            env: baseEnv(),
            rest,
            statePath,
        });

        expect(result.targets).toEqual([{
            action: 'skipped-unchanged',
            hash,
            key: 'global:client-1',
            target: 'global',
        }]);
        expect(rest.get).not.toHaveBeenCalled();
        expect(rest.put).not.toHaveBeenCalled();
    });

    it('updates Discord and stores the manifest hash when local commands changed', async () => {
        const statePath = await makeStatePath();
        const rest = createRest([]);
        const result = await deployCommands({
            commandSets,
            env: baseEnv(),
            now: () => new Date('2026-06-25T12:00:00.000Z'),
            rest,
            statePath,
        });

        const hash = hashCommands(commandSets.globalCommands);
        expect(result.targets).toEqual([{
            action: 'updated',
            hash,
            key: 'global:client-1',
            target: 'global',
        }]);
        expect(rest.get).toHaveBeenCalledWith('/applications/client-1/commands');
        expect(rest.put).toHaveBeenCalledWith('/applications/client-1/commands', { body: commandSets.globalCommands });

        const state = JSON.parse(await readFile(statePath, 'utf8')) as {
            deployments: Record<string, { hash: string; updatedAt: string }>;
        };
        expect(state.deployments['global:client-1']).toEqual({
            hash,
            updatedAt: '2026-06-25T12:00:00.000Z',
        });
    });

    it('stores the manifest hash after a successful up-to-date Discord check', async () => {
        const statePath = await makeStatePath();
        const rest = createRest([
            {
                ...commandSets.globalCommands[0],
                application_id: 'client-1',
                id: 'remote-command-id',
                version: 'remote-version',
            },
        ]);

        const result = await deployCommands({
            commandSets,
            env: baseEnv(),
            rest,
            statePath,
        });

        expect(result.targets[0]?.action).toBe('checked');
        expect(rest.put).not.toHaveBeenCalled();

        const state = JSON.parse(await readFile(statePath, 'utf8')) as {
            deployments: Record<string, { hash: string }>;
        };
        expect(state.deployments['global:client-1']?.hash).toBe(hashCommands(commandSets.globalCommands));
    });

    it('always mode checks Discord even when the saved hash matches', async () => {
        const statePath = await makeStatePath();
        await writeState(statePath, 'global:client-1', hashCommands(commandSets.globalCommands));
        const rest = createRest(commandSets.globalCommands);

        const result = await deployCommands({
            commandSets,
            env: baseEnv({ COMMAND_DEPLOY_MODE: 'always' }),
            rest,
            statePath,
        });

        expect(result.targets[0]?.action).toBe('checked');
        expect(rest.get).toHaveBeenCalledTimes(1);
        expect(rest.put).not.toHaveBeenCalled();
    });

    it('deploys guild commands to the configured guild target', async () => {
        const rest = createRest([]);
        const statePath = await makeStatePath();

        const result = await deployCommands({
            commandSets,
            env: baseEnv({
                COMMAND_DEPLOY_GUILD_ID: 'guild-1',
                COMMAND_DEPLOY_SCOPE: 'guild',
            }),
            rest,
            statePath,
        });

        expect(result.targets[0]).toEqual(expect.objectContaining({
            action: 'updated',
            key: 'guild:client-1:guild-1',
            target: 'guild',
        }));
        expect(rest.get).toHaveBeenCalledWith('/applications/client-1/guilds/guild-1/commands');
        expect(rest.put).toHaveBeenCalledWith('/applications/client-1/guilds/guild-1/commands', { body: commandSets.guildCommands });
    });

    it('rejects guild deployment without a guild id', () => {
        expect(() => resolveCommandDeployConfig(baseEnv({ COMMAND_DEPLOY_SCOPE: 'guild' })))
            .toThrow(/COMMAND_DEPLOY_GUILD_ID or GUILD_ID is required/);
    });
});
