import React from "react";
import { Box } from "@mui/material";
import ConfigCard, { type ConfigHealthInfo, type ConfigStatusChip } from "@/components/ConfigCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";
import type { IntegrationHealthRecord } from "@/lib/api-client";
import { getNotificationInfo } from "@/lib/notificationTiming";

interface NotificationConfigListProps<T extends StreamingConfig> {
    configs: T[];
    channelNameField: string;
    channelNameLabel: string;
    getChannelName: (channelId: string) => string;
    onEdit: (config: T) => void;
    onDelete: (config: T) => void;
    onTogglePaused?: (config: T) => void;
    moduleName: string;
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
    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? "Channel" : "Streamer");
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? "Channels" : "Streamers");

    if (configs.length === 0) {
        return (
            <EmptyState
                icon={emptyStateIcon}
                title={emptyTitle ?? `No ${moduleName} ${plural} Configured`}
                description={emptyDescription ?? `Add your first ${moduleName} ${singular.toLowerCase()} to start receiving notifications.`}
                accent={moduleColor}
            />
        );
    }

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {configs.map((config) => {
                const value = String((config as any)[channelNameField] ?? "").trim();
                const displayTitle = String((config as any).youtubeChannelTitle ?? (value || `${moduleName} ${singular}`));
                const configPaused = Boolean((config as { paused?: unknown }).paused);
                const health = getHealthForConfig(config, healthByConfigId);
                const healthChip = configPaused ? null : getHealthChip(health, healthLoading);
                const healthInfo = getHealthInfo(health);
                const notificationInfo = getNotificationInfo(config as {
                    cooldownMinutes?: unknown;
                    quietHoursStart?: unknown;
                    quietHoursEnd?: unknown;
                });
                const statusChip = configPaused
                    ? { label: "Paused", color: "info" as const, variant: "outlined" as const }
                    : renderChip?.(config);
                return (
                    <ConfigCard
                        key={(config as any).id || `${value}-${(config as any).discordChannelId}`}
                        title={displayTitle}
                        accent={moduleColor}
                        channelInfo={{
                            label: channelNameLabel,
                            value: value || "Unknown"
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

function getHealthChip(health: IntegrationHealthRecord | null, loading: boolean): ConfigStatusChip | null {
    if (loading) return { label: "Checking...", color: "default", variant: "outlined" };
    if (!health) return { label: "Not checked", color: "default", variant: "outlined" };
    if (health.status === "healthy") return { label: "Healthy", color: "success", variant: "outlined" };
    if (health.status === "warning") return { label: "Warning", color: "warning", variant: "outlined" };
    if (health.status === "paused") return { label: "Paused", color: "info", variant: "outlined" };
    if (health.status === "error") return { label: `Failing x${Math.max(1, health.consecutiveFailures)}`, color: "error", variant: "outlined" };
    return { label: "Unknown", color: "default", variant: "outlined" };
}

function getHealthInfo(health: IntegrationHealthRecord | null): ConfigHealthInfo | undefined {
    if (!health) return undefined;

    const lines = [
        `Last checked: ${formatDateTime(health.lastCheckedAt)}`,
        `Last delivery: ${formatDateTime(health.lastDeliveryAt)}`,
    ];
    if (health.lastErrorCode) {
        lines.push(`Last error code: ${health.lastErrorCode}`);
    }

    return {
        lines,
        error: health.lastErrorMessage ?? null,
    };
}

function formatDateTime(value?: string | null): string {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}
