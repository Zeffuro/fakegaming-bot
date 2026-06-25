import path from 'path';
import { resolveDataRoot } from '@zeffuro/fakegaming-common/core';
import type { CommandDeployConfig, CommandDeployMode, CommandDeployScope } from './commandDeployTypes.js';

const validDeployModes = new Set<CommandDeployMode>(['auto', 'always', 'never']);
const validDeployScopes = new Set<CommandDeployScope>(['global', 'guild', 'both']);

export function resolveCommandDeployConfig(env: NodeJS.ProcessEnv = process.env): CommandDeployConfig {
    const forceDeploy = isTruthyEnv(env.FORCE_DEPLOY_COMMANDS);
    const rawMode = forceDeploy
        ? 'always'
        : normalizeEnvChoice(env.COMMAND_DEPLOY_MODE) ?? (env.NODE_ENV === 'development' ? 'always' : 'auto');
    const rawScope = normalizeEnvChoice(env.COMMAND_DEPLOY_SCOPE)
        ?? (env.NODE_ENV === 'development' && readGuildId(env) ? 'guild' : 'global');

    if (!validDeployModes.has(rawMode as CommandDeployMode)) {
        throw new Error(`Invalid COMMAND_DEPLOY_MODE '${rawMode}'. Expected auto, always, or never.`);
    }
    if (!validDeployScopes.has(rawScope as CommandDeployScope)) {
        throw new Error(`Invalid COMMAND_DEPLOY_SCOPE '${rawScope}'. Expected global, guild, or both.`);
    }

    const mode = rawMode as CommandDeployMode;
    const scope = rawScope as CommandDeployScope;
    const clientId = trimOptionalEnv(env.CLIENT_ID) ?? '';
    const guildId = readGuildId(env);

    if (mode !== 'never' && !clientId) {
        throw new Error('CLIENT_ID is required for command deployment.');
    }
    if (mode !== 'never' && (scope === 'guild' || scope === 'both') && !guildId) {
        throw new Error('COMMAND_DEPLOY_GUILD_ID or GUILD_ID is required for guild command deployment.');
    }

    return { mode, scope, clientId, guildId };
}

export function resolveCommandDeployStatePath(env: NodeJS.ProcessEnv = process.env): string {
    const explicitPath = trimOptionalEnv(env.COMMAND_DEPLOY_STATE_PATH);
    if (explicitPath) return path.resolve(explicitPath);

    return path.join(resolveDataRoot(), 'command-deploy-state.json');
}

export function trimOptionalEnv(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function isTruthyEnv(value: string | undefined): boolean {
    return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function normalizeEnvChoice(value: string | undefined): string | undefined {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : undefined;
}

function readGuildId(env: NodeJS.ProcessEnv): string | undefined {
    return trimOptionalEnv(env.COMMAND_DEPLOY_GUILD_ID) ?? trimOptionalEnv(env.GUILD_ID);
}
