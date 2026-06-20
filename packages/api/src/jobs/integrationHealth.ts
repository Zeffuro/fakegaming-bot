import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

interface IntegrationHealthConfig {
    id?: string | number | null;
    guildId?: string | null;
    discordChannelId?: string | null;
    channelId?: string | null;
}

interface IntegrationHealthRecorder {
    recordSuccess(input: {
        provider: string;
        configId: string | number;
        guildId?: string | null;
        channelId?: string | null;
        delivered?: boolean;
        metadata?: Record<string, unknown> | null;
        checkedAt?: Date;
    }): Promise<void>;
    recordFailure(input: {
        provider: string;
        configId: string | number;
        guildId?: string | null;
        channelId?: string | null;
        errorCode: string;
        errorMessage: string;
        metadata?: Record<string, unknown> | null;
        checkedAt?: Date;
    }): Promise<void>;
}

const log = getLogger({ name: 'api:jobs:integration-health' });

export async function recordIntegrationSuccess(
    provider: string,
    config: IntegrationHealthConfig,
    options: {
        delivered?: boolean;
        metadata?: Record<string, unknown> | null;
        checkedAt?: Date;
    } = {},
): Promise<void> {
    const recorder = getIntegrationHealthRecorder();
    const configId = getConfigId(config);
    if (!recorder || !configId) return;

    try {
        await recorder.recordSuccess({
            provider,
            configId,
            guildId: config.guildId ?? null,
            channelId: getChannelId(config),
            delivered: options.delivered ?? false,
            metadata: options.metadata ?? null,
            checkedAt: options.checkedAt,
        });
    } catch (err) {
        log.debug({ err, provider, configId }, 'Failed to record integration health success');
    }
}

export async function recordIntegrationFailure(
    provider: string,
    config: IntegrationHealthConfig,
    error: unknown,
    options: {
        errorCode?: string;
        metadata?: Record<string, unknown> | null;
        checkedAt?: Date;
    } = {},
): Promise<void> {
    const recorder = getIntegrationHealthRecorder();
    const configId = getConfigId(config);
    if (!recorder || !configId) return;

    try {
        await recorder.recordFailure({
            provider,
            configId,
            guildId: config.guildId ?? null,
            channelId: getChannelId(config),
            errorCode: options.errorCode ?? getErrorCode(error),
            errorMessage: getErrorMessage(error),
            metadata: options.metadata ?? null,
            checkedAt: options.checkedAt,
        });
    } catch (err) {
        log.debug({ err, provider, configId }, 'Failed to record integration health failure');
    }
}

function getIntegrationHealthRecorder(): IntegrationHealthRecorder | null {
    const maybeManager = (getConfigManager() as { integrationHealthManager?: unknown }).integrationHealthManager;
    if (!isIntegrationHealthRecorder(maybeManager)) return null;
    return maybeManager;
}

function isIntegrationHealthRecorder(value: unknown): value is IntegrationHealthRecorder {
    return typeof value === 'object'
        && value !== null
        && typeof (value as { recordSuccess?: unknown }).recordSuccess === 'function'
        && typeof (value as { recordFailure?: unknown }).recordFailure === 'function';
}

function getConfigId(config: IntegrationHealthConfig): string | number | null {
    if (typeof config.id === 'string' && config.id.length > 0) return config.id;
    if (typeof config.id === 'number' && Number.isFinite(config.id)) return config.id;
    return null;
}

function getChannelId(config: IntegrationHealthConfig): string | null {
    return config.discordChannelId ?? config.channelId ?? null;
}

function getErrorCode(error: unknown): string {
    if (error instanceof Error && error.name) return error.name;
    return 'CHECK_FAILED';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown integration health error';
}
