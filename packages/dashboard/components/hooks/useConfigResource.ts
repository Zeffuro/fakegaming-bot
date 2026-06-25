import { useEffect, useState } from "react";

type GuildIdParam = string | string[];

interface ResourceMessages {
    loadFailed: string;
    createFailed: string;
    updateFailed: string;
    deleteFailed: string;
}

interface PausableConfig {
    id?: string | number | null;
    paused?: boolean | null;
}

interface UseConfigResourceOptions<TConfig extends PausableConfig, TCreate> {
    guildId: GuildIdParam;
    enabled?: boolean;
    load: (guildId: string) => Promise<TConfig[]>;
    create: (config: TCreate, guildId: string) => Promise<void>;
    update: (config: TConfig, guildId: string) => Promise<void>;
    setPaused?: (config: TConfig, paused: boolean) => Promise<void>;
    deleteConfig: (config: TConfig) => Promise<void>;
    removeById: (configId: string) => Promise<void>;
    validateCreate?: (config: TCreate) => string | null;
    messages: ResourceMessages;
}

interface NotificationTimingInput {
    customMessage?: string;
    cooldownMinutes?: unknown;
    quietHoursStart?: unknown;
    quietHoursEnd?: unknown;
    paused?: unknown;
    vodFollowupEnabled?: unknown;
    vodFollowupDelayMinutes?: unknown;
}

interface NotificationTimingPayload {
    customMessage?: string;
    cooldownMinutes: number | null;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    paused: boolean;
    vodFollowupEnabled?: boolean;
    vodFollowupDelayMinutes?: number | null;
}

export function resolveGuildId(guildId: GuildIdParam): string | null {
    if (Array.isArray(guildId)) return guildId[0] ?? null;
    return guildId || null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function buildNotificationTimingPayload(config: NotificationTimingInput): NotificationTimingPayload {
    const vodDelay = typeof config.vodFollowupDelayMinutes === "number"
        ? config.vodFollowupDelayMinutes
        : config.vodFollowupDelayMinutes === null
            ? null
            : undefined;

    return {
        customMessage: config.customMessage,
        cooldownMinutes: typeof config.cooldownMinutes === "number" ? config.cooldownMinutes : null,
        quietHoursStart: config.quietHoursStart ? String(config.quietHoursStart) : null,
        quietHoursEnd: config.quietHoursEnd ? String(config.quietHoursEnd) : null,
        paused: Boolean(config.paused),
        ...(typeof config.vodFollowupEnabled === "boolean" ? { vodFollowupEnabled: config.vodFollowupEnabled } : {}),
        ...(vodDelay !== undefined ? { vodFollowupDelayMinutes: vodDelay } : {})
    };
}

function getConfigId(config: PausableConfig): string | null {
    if (config.id === undefined || config.id === null) return null;
    const id = String(config.id);
    return id.length > 0 ? id : null;
}

export function useConfigResource<TConfig extends PausableConfig, TCreate>({
    guildId,
    enabled = true,
    load,
    create,
    update,
    setPaused,
    deleteConfig,
    removeById,
    validateCreate,
    messages
}: UseConfigResourceOptions<TConfig, TCreate>) {
    const [configs, setConfigs] = useState<TConfig[]>([]);
    const [loading, setLoading] = useState(enabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConfigs = async () => {
        const resolvedGuildId = resolveGuildId(guildId);
        if (!enabled || !resolvedGuildId) {
            setConfigs([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setConfigs(await load(resolvedGuildId));
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.loadFailed));
        } finally {
            setLoading(false);
        }
    };

    const addConfig = async (config: TCreate) => {
        const validationError = validateCreate?.(config);
        if (validationError) {
            setError(validationError);
            return false;
        }

        const resolvedGuildId = resolveGuildId(guildId);
        if (!resolvedGuildId) {
            setError(messages.createFailed);
            return false;
        }

        try {
            setSaving(true);
            await create(config, resolvedGuildId);
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.createFailed));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = async (config: TConfig) => {
        const resolvedGuildId = resolveGuildId(guildId);
        if (!resolvedGuildId) {
            setError(messages.updateFailed);
            return false;
        }

        try {
            setSaving(true);
            await update(config, resolvedGuildId);
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.updateFailed));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const togglePausedConfig = setPaused ? async (config: TConfig) => {
        const configId = getConfigId(config);
        if (!configId) {
            setError(messages.updateFailed);
            return false;
        }

        try {
            setSaving(true);
            await setPaused(config, !Boolean(config.paused));
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.updateFailed));
            return false;
        } finally {
            setSaving(false);
        }
    } : undefined;

    const setAllPausedConfigs = setPaused ? async (paused: boolean) => {
        const targets = configs.filter((config) => getConfigId(config) && Boolean(config.paused) !== paused);
        if (targets.length === 0) return true;

        try {
            setSaving(true);
            await Promise.all(targets.map((config) => setPaused(config, paused)));
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.updateFailed));
            return false;
        } finally {
            setSaving(false);
        }
    } : undefined;

    const deleteExistingConfig = async (config: TConfig) => {
        try {
            setSaving(true);
            await deleteConfig(config);
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.deleteFailed));
            return false;
        } finally {
            setSaving(false);
        }
    };

    const removeConfig = async (configId: string) => {
        try {
            setSaving(true);
            await removeById(configId);
            await fetchConfigs();
            return true;
        } catch (err: unknown) {
            setError(getErrorMessage(err, messages.deleteFailed));
            return false;
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        if (!enabled || !resolveGuildId(guildId)) {
            setConfigs([]);
            setLoading(false);
            return;
        }

        void fetchConfigs();
    }, [enabled, guildId]);

    return {
        configs,
        loading,
        error,
        saving,
        setError,
        addConfig,
        updateConfig,
        togglePausedConfig,
        setAllPausedConfigs,
        deleteConfig: deleteExistingConfig,
        removeConfig,
        refreshConfigs: fetchConfigs
    };
}
