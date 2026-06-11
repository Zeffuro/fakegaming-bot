import React from "react";
import { Box } from "@mui/material";
import ConfigCard from "@/components/ConfigCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import type { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface NotificationConfigListProps<T extends StreamingConfig> {
    configs: T[];
    channelNameField: string;
    channelNameLabel: string;
    getChannelName: (channelId: string) => string;
    onEdit: (config: T) => void;
    onDelete: (config: T) => void;
    moduleName: string;
    moduleColor?: string;
    saving: boolean;
    emptyStateIcon: React.ReactElement;
    renderChip?: (config: T) => {
        label: string;
        color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
        variant?: "filled" | "outlined";
    } | undefined;
    itemSingularLabel?: string;
    itemPluralLabel?: string;
    canEdit?: boolean;
}

export default function NotificationConfigList<T extends StreamingConfig>({
    configs,
    channelNameField,
    channelNameLabel,
    getChannelName,
    onEdit,
    onDelete,
    moduleName,
    moduleColor = dashboardAccents.neutral,
    saving,
    emptyStateIcon,
    renderChip,
    itemSingularLabel,
    itemPluralLabel,
    canEdit = true,
}: NotificationConfigListProps<T>) {
    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? "Channel" : "Streamer");
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? "Channels" : "Streamers");

    if (configs.length === 0) {
        return (
            <EmptyState
                icon={emptyStateIcon}
                title={`No ${moduleName} ${plural} Configured`}
                description={`Add your first ${moduleName} ${singular.toLowerCase()} to start receiving notifications.`}
                accent={moduleColor}
            />
        );
    }

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {configs.map((config) => {
                const value = String((config as any)[channelNameField] ?? "").trim();
                const displayTitle = String((config as any).youtubeChannelTitle ?? (value || `${moduleName} ${singular}`));
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
                        statusChip={renderChip ? renderChip(config) : undefined}
                        onEdit={() => onEdit(config)}
                        onDelete={() => onDelete(config)}
                        saving={saving}
                        showEdit={canEdit}
                    />
                );
            })}
        </Box>
    );
}
