import React from "react";
import { Box } from "@mui/material";
import ConfigCard, { type ConfigHealthInfo, type ConfigStatusChip } from "@/components/ConfigCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";
import type { IntegrationHealthRecord } from "@/lib/api-client";
import { getNotificationInfo } from "@/lib/notificationTiming";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface NotificationConfigListProps<T extends StreamingConfig> {
    configs: T[];
    channelNameField: string;
    channelNameLabel: string;
    getChannelName: (channelId: string) => string;
    onEdit: (config: T) => void;
    onDelete: (config: T) => void;
    onTogglePaused?: (config: T) => void;
    moduleName: string;
    moduleDisplayName?: string;
    moduleColor?: string;
    saving: boolean;
    emptyStateIcon: React.ReactElement;
    renderChip?: (config: T) => ConfigStatusChip | undefined;
    healthByConfigId?: Map<string, IntegrationHealthRecord>;
    healthLoading?: boolean;
    itemSingularLabel?: string;
    itemPluralLabel?: string;
    canEdit?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
}

export default function NotificationConfigList<T extends StreamingConfig>({
    configs,
    channelNameField,
    channelNameLabel,
    getChannelName,
    onEdit,
    onDelete,
    onTogglePaused,
    moduleName,
    moduleDisplayName = moduleName,
    moduleColor = dashboardAccents.neutral,
    saving,
    emptyStateIcon,
    renderChip,
    healthByConfigId,
    healthLoading = false,
    itemSingularLabel,
    itemPluralLabel,
    canEdit = true,
    emptyTitle,
    emptyDescription,
}: NotificationConfigListProps<T>) {
    const { t, formatDate } = useDashboardI18n();
    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? t("config.channel") : t("config.streamer"));
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? t("config.channels") : t("config.streamers"));

    if (configs.length === 0) {
        return (
            <EmptyState
                icon={emptyStateIcon}
                title={emptyTitle ?? t("notifications.noConfigured", { module: moduleDisplayName, items: plural.toLowerCase() })}
                description={emptyDescription ?? t("notifications.addFirst", { module: moduleDisplayName, item: singular.toLowerCase() })}
                accent={moduleColor}
            />
        );
    }

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {configs.map((config) => {
                const value = String((config as any)[channelNameField] ?? "").trim();
                const displayTitle = String((config as any).youtubeChannelTitle ?? (value || `${moduleDisplayName} ${singular}`));
                const configPaused = Boolean((config as { paused?: unknown }).paused);
                const health = getHealthForConfig(config, healthByConfigId);
                const healthChip = configPaused ? null : getHealthChip(health, healthLoading, t);
                const healthInfo = getHealthInfo(health, t, formatDate);
                const notificationInfo = getNotificationInfo(config as {
                    cooldownMinutes?: unknown;
                    quietHoursStart?: unknown;
                    quietHoursEnd?: unknown;
                });
                const statusChip = configPaused
                    ? { label: t("common.paused"), color: "info" as const, variant: "outlined" as const }
                    : renderChip?.(config);
                return (
                    <ConfigCard
                        key={(config as any).id || `${value}-${(config as any).discordChannelId}`}
                        title={displayTitle}
                        accent={moduleColor}
                        channelInfo={{
                            label: channelNameLabel,
                            value: value || t("common.unknown")
                        }}
                        discordChannel={getChannelName((config as any).discordChannelId)}
                        customMessage={(config as any).customMessage}
                        statusChip={statusChip}
                        extraStatusChips={healthChip ? [healthChip] : []}
                        healthInfo={healthInfo}
                        notificationInfo={notificationInfo}
                        onEdit={() => onEdit(config)}
                        onDelete={() => onDelete(config)}
                        onTogglePaused={onTogglePaused ? () => onTogglePaused(config) : undefined}
                        paused={configPaused}
                        saving={saving}
                        showEdit={canEdit}
                    />
                );
            })}
        </Box>
    );
}

function getHealthForConfig<T extends StreamingConfig>(
    config: T,
    healthByConfigId: Map<string, IntegrationHealthRecord> | undefined
): IntegrationHealthRecord | null {
    if (!healthByConfigId || config.id === undefined || config.id === null) return null;
    return healthByConfigId.get(String(config.id)) ?? null;
}

function getHealthChip(health: IntegrationHealthRecord | null, loading: boolean, t: ReturnType<typeof useDashboardI18n>["t"]): ConfigStatusChip | null {
    if (loading) return { label: t("common.checking"), color: "default", variant: "outlined" };
    if (!health) return { label: t("common.notChecked"), color: "default", variant: "outlined" };
    if (health.status === "healthy") return { label: t("common.healthy"), color: "success", variant: "outlined" };
    if (health.status === "warning") return { label: t("common.warning"), color: "warning", variant: "outlined" };
    if (health.status === "paused") return { label: t("common.paused"), color: "info", variant: "outlined" };
    if (health.status === "error") return { label: t("config.failingCount", { count: Math.max(1, health.consecutiveFailures) }), color: "error", variant: "outlined" };
    return { label: t("common.unknown"), color: "default", variant: "outlined" };
}

function getHealthInfo(health: IntegrationHealthRecord | null, t: ReturnType<typeof useDashboardI18n>["t"], formatDate: ReturnType<typeof useDashboardI18n>["formatDate"]): ConfigHealthInfo | undefined {
    if (!health) return undefined;

    const lines = [
        t("config.lastChecked", { value: formatDateTime(health.lastCheckedAt, t, formatDate) }),
        t("config.lastDelivery", { value: formatDateTime(health.lastDeliveryAt, t, formatDate) }),
    ];
    if (health.lastErrorCode) {
        lines.push(t("config.lastErrorCode", { value: health.lastErrorCode }));
    }

    return {
        lines,
        error: health.lastErrorMessage ?? null,
    };
}

function formatDateTime(value: string | null | undefined, t: ReturnType<typeof useDashboardI18n>["t"], formatDate: ReturnType<typeof useDashboardI18n>["formatDate"]): string {
    if (!value) return t("common.never");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, { dateStyle: "medium", timeStyle: "short" });
}
