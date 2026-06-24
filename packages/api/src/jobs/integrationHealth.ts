import { getLogger } from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

interface IntegrationHealthConfig {
    id?: string | number | null;
    guildId?: string | null;
    discordChannelId?: string | null;
    channelId?: string | null;
    cooldownMinutes?: number | string | null;
    lastNotifiedAt?: string | number | Date | null;
    lastAnnouncedAt?: string | number | Date | null;
    paused?: boolean | number | string | null;
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
            metadata: buildIntegrationHealthMetadata(config, options.metadata ?? null, options.checkedAt),
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
            metadata: buildIntegrationHealthMetadata(config, options.metadata ?? null, options.checkedAt),
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

function buildIntegrationHealthMetadata(
    config: IntegrationHealthConfig,
    metadata: Record<string, unknown> | null,
    checkedAt?: Date,
): Record<string, unknown> | null {
    const timingMetadata = buildNotificationTimingMetadata(config, checkedAt ?? new Date());
    if (!timingMetadata && !metadata) return null;
    return {
        ...(timingMetadata ?? {}),
        ...(metadata ?? {}),
    };
}

function buildNotificationTimingMetadata(
    config: IntegrationHealthConfig,
    checkedAt: Date,
): Record<string, unknown> | null {
    const timing: Record<string, unknown> = {};
    const paused = normalizePaused(config.paused);
    const cooldownMinutes = normalizeCooldownMinutes(config.cooldownMinutes);
    const lastNotifiedAt = normalizeDateIso(config.lastNotifiedAt ?? config.lastAnnouncedAt ?? null);

    if (paused !== null) timing.paused = paused;
    if (cooldownMinutes !== null) timing.cooldownMinutes = cooldownMinutes;
    if (lastNotifiedAt) timing.lastNotifiedAt = lastNotifiedAt;

    if (cooldownMinutes !== null && cooldownMinutes > 0 && lastNotifiedAt) {
        const cooldownUntilMs = Date.parse(lastNotifiedAt) + cooldownMinutes * 60_000;
        if (Number.isFinite(cooldownUntilMs)) {
            timing.cooldownUntil = new Date(cooldownUntilMs).toISOString();
            timing.cooldownActive = cooldownUntilMs > checkedAt.getTime();
        }
    }

    return Object.keys(timing).length > 0 ? timing : null;
}

function normalizePaused(value: boolean | number | string | null | undefined): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
}

function normalizeCooldownMinutes(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
}

function normalizeDateIso(value: string | number | Date | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
