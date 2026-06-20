import { useEffect, useState } from "react";

type GuildIdParam = string | string[];

interface ResourceMessages {
    loadFailed: string;
    createFailed: string;
    updateFailed: string;
    deleteFailed: string;
}

interface UseConfigResourceOptions<TConfig, TCreate> {
    guildId: GuildIdParam;
    enabled?: boolean;
    load: (guildId: string) => Promise<TConfig[]>;
    create: (config: TCreate, guildId: string) => Promise<void>;
    update: (config: TConfig, guildId: string) => Promise<void>;
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
}

export function resolveGuildId(guildId: GuildIdParam): string | null {
    if (Array.isArray(guildId)) return guildId[0] ?? null;
    return guildId || null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function buildNotificationTimingPayload(config: NotificationTimingInput): {
    customMessage?: string;
    cooldownMinutes: number | null;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
} {
    return {
        customMessage: config.customMessage,
        cooldownMinutes: typeof config.cooldownMinutes === "number" ? config.cooldownMinutes : null,
        quietHoursStart: config.quietHoursStart ? String(config.quietHoursStart) : null,
        quietHoursEnd: config.quietHoursEnd ? String(config.quietHoursEnd) : null
    };
}

export function useConfigResource<TConfig, TCreate>({
    guildId,
    enabled = true,
    load,
    create,
    update,
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
        deleteConfig: deleteExistingConfig,
        removeConfig,
        refreshConfigs: fetchConfigs
    };
}
