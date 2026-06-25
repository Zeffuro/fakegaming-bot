import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/rest/v10';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { bootstrapEnv } from '@zeffuro/fakegaming-common/core';
import { getLogger } from '@zeffuro/fakegaming-common';
import { BOT_COMMANDS } from '@zeffuro/fakegaming-common/manifest/bot-manifest';
import { findCommandFiles } from './core/commandsFs.js';
import { resolveCommandDeployConfig, resolveCommandDeployStatePath, trimOptionalEnv } from './core/commandDeployConfig.js';
import { commandsAreDifferent, findDuplicateNames, hashCommands, normalizeResponseCommands } from './core/commandDeployHash.js';
import { readCommandDeployState, writeCommandDeployState } from './core/commandDeployState.js';
import type {
    CommandDeployConfig,
    CommandDeployMode,
    CommandDeployOptions,
    CommandDeployResult,
    CommandDeployState,
    CommandDeployTarget,
    CommandDeployTargetResult,
    CommandSet,
    RestClient,
} from './core/commandDeployTypes.js';

export {
    resolveCommandDeployConfig,
    resolveCommandDeployStatePath,
} from './core/commandDeployConfig.js';
export {
    hashCommands,
} from './core/commandDeployHash.js';
export type {
    CommandDeployAction,
    CommandDeployConfig,
    CommandDeployMode,
    CommandDeployResult,
    CommandDeployScope,
    CommandDeployTargetResult,
    CommandSet,
} from './core/commandDeployTypes.js';

const { __dirname } = bootstrapEnv(import.meta.url);
const log = getLogger({ name: 'bot:commands:deploy' });

interface CommandModule {
    default?: {
        data?: {
            toJSON: () => Record<string, unknown>;
        };
    };
}

export async function deployCommands(options: CommandDeployOptions = {}): Promise<CommandDeployResult> {
    const env = options.env ?? process.env;
    const config = resolveCommandDeployConfig(env);

    if (config.mode === 'never') {
        log.info('Command deployment disabled by COMMAND_DEPLOY_MODE=never');
        return { mode: config.mode, scope: config.scope, targets: [] };
    }

    const token = trimOptionalEnv(env.DISCORD_BOT_TOKEN);
    if (!token) {
        throw new Error('DISCORD_BOT_TOKEN is required for command deployment.');
    }

    const commandSets = options.commandSets ?? await buildCommandSets();
    const targets = buildDeployTargets(config, commandSets);
    const statePath = options.statePath ?? resolveCommandDeployStatePath(env);
    const state = await readCommandDeployState(statePath, log);
    const rest = options.rest ?? (new REST({ version: '10' }).setToken(token) as RestClient);
    const now = options.now ?? (() => new Date());
    const results: CommandDeployTargetResult[] = [];

    for (const target of targets) {
        const result = await deployTarget({
            mode: config.mode,
            now,
            rest,
            state,
            target,
        });
        results.push(result);
    }

    if (results.some(result => result.action === 'checked' || result.action === 'updated')) {
        await writeCommandDeployState(statePath, state);
    }

    return {
        mode: config.mode,
        scope: config.scope,
        statePath,
        targets: results,
    };
}

async function buildCommandSets(): Promise<CommandSet> {
    const modulesPath = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesPath)) {
        throw new Error(`Modules directory not found at ${modulesPath}`);
    }

    const commandFiles = findCommandFiles(modulesPath);
    const implByName = new Map<string, Record<string, unknown>>();
    for (const commandPath of commandFiles) {
        const commandModule = await import(pathToFileURL(commandPath).href) as CommandModule;
        const json = commandModule.default?.data?.toJSON();
        const name = typeof json?.name === 'string' ? json.name : '';
        if (name && json) implByName.set(name, json);
    }

    const globalCommands: object[] = [];
    const guildCommands: object[] = [];

    for (const meta of BOT_COMMANDS) {
        const payload = implByName.get(meta.name);
        if (!payload) {
            throw new Error(`Implementation for command '${meta.name}' not found. Ensure a command file exists and matches the manifest name.`);
        }

        const registrationPayload = { ...payload };
        if (typeof meta.dm_permission === 'boolean') {
            registrationPayload.dm_permission = meta.dm_permission;
        }
        if (meta.default_member_permissions != null) {
            registrationPayload.default_member_permissions = meta.default_member_permissions;
        }

        if (meta.testOnly) {
            guildCommands.push(registrationPayload);
        } else {
            globalCommands.push(registrationPayload);
            guildCommands.push(registrationPayload);
        }
    }

    const globalDupes = findDuplicateNames(globalCommands);
    const guildDupes = findDuplicateNames(guildCommands);
    if (globalDupes.length || guildDupes.length) {
        throw new Error(
            `Duplicate command names found:\nGlobal: ${globalDupes.join(', ')}\nGuild: ${guildDupes.join(', ')}`
        );
    }

    return { globalCommands, guildCommands };
}

function buildDeployTargets(config: CommandDeployConfig, commandSets: CommandSet): CommandDeployTarget[] {
    const targets: CommandDeployTarget[] = [];

    if (config.scope === 'global' || config.scope === 'both') {
        const commands = commandSets.globalCommands;
        targets.push({
            commands,
            hash: hashCommands(commands),
            key: `global:${config.clientId}`,
            route: Routes.applicationCommands(config.clientId),
            target: 'global',
        });
    }

    if (config.scope === 'guild' || config.scope === 'both') {
        if (!config.guildId) {
            throw new Error('Guild command deployment target was requested without a guild id.');
        }

        const commands = commandSets.guildCommands;
        targets.push({
            commands,
            hash: hashCommands(commands),
            key: `guild:${config.clientId}:${config.guildId}`,
            route: Routes.applicationGuildCommands(config.clientId, config.guildId),
            target: 'guild',
        });
    }

    return targets;
}

async function deployTarget(args: {
    mode: CommandDeployMode;
    now: () => Date;
    rest: RestClient;
    state: CommandDeployState;
    target: CommandDeployTarget;
}): Promise<CommandDeployTargetResult> {
    const { mode, now, rest, state, target } = args;
    const previous = state.deployments?.[target.key];

    if (mode === 'auto' && previous?.hash === target.hash) {
        log.info({ target: target.target, key: target.key }, 'Command manifest unchanged; skipping Discord command deployment');
        return {
            action: 'skipped-unchanged',
            hash: target.hash,
            key: target.key,
            target: target.target,
        };
    }

    const existing = normalizeResponseCommands(await rest.get(target.route));
    const action = commandsAreDifferent(existing, target.commands)
        ? 'updated'
        : 'checked';

    if (action === 'updated') {
        const updated = await rest.put(target.route, { body: target.commands });
        log.info({
            count: Array.isArray(updated) ? updated.length : target.commands.length,
            target: target.target,
        }, 'Updated Discord application commands');
    } else {
        log.info({ target: target.target }, 'Discord application commands are up to date');
    }

    const deployments = state.deployments ?? {};
    deployments[target.key] = {
        hash: target.hash,
        updatedAt: now().toISOString(),
    };
    state.deployments = deployments;

    return {
        action,
        hash: target.hash,
        key: target.key,
        target: target.target,
    };
}
