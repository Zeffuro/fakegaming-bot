import React from "react";
import { Grid, Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ConfigCard from "@/components/ConfigCard";
import { StreamingConfig } from "@/components/hooks/useStreamingForm";

interface NotificationConfigListProps<T extends StreamingConfig> {
    configs: T[];
    channelNameField: string;
    channelNameLabel: string;
    getChannelName: (channelId: string) => string;
    onEdit: (config: T) => void;
    onDelete: (config: T) => void;
    moduleName: string;
    saving: boolean;
    emptyStateIcon: React.ReactElement & { props?: { sx?: SxProps<Theme> } };
    renderChip?: (config: T) => {
        label: string;
        color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
        variant?: "filled" | "outlined";
    } | undefined;
    itemSingularLabel?: string;
    itemPluralLabel?: string;
    // New: toggle edit action visibility
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
                                                                              saving,
                                                                              emptyStateIcon,
                                                                              renderChip,
                                                                              itemSingularLabel,
                                                                              itemPluralLabel,
                                                                              canEdit = true,
                                                                          }: NotificationConfigListProps<T>) {
    const singular = itemSingularLabel ?? (moduleName === 'YouTube' ? 'Channel' : 'Streamer');
    const plural = itemPluralLabel ?? (moduleName === 'YouTube' ? 'Channels' : 'Streamers');

    if (configs.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                {React.cloneElement(emptyStateIcon, {
                    sx: { fontSize: 64, color: 'grey.500', mb: 2 }
                })}
                <Typography variant="h6" sx={{ mb: 1, color: 'grey.400' }}>
                    No {moduleName} {plural.toLowerCase()} configured
                </Typography>
                <Typography variant="body2" sx={{ color: 'grey.500' }}>
                    Add your first {moduleName} {singular.toLowerCase()} to start receiving notifications
                </Typography>
            </Box>
        );
    }

    return (
        <Grid container spacing={2}>
            {configs.map((config) => (
                <Grid
                    sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}
                    key={(config as any).id || `${(config as any)[channelNameField]}-${(config as any).discordChannelId}`}
                >
                    <ConfigCard
                        title={`${moduleName} ${singular}`}
                        channelInfo={{
                            label: channelNameLabel,
                            value: (config as any)[channelNameField] as string
                        }}
                        discordChannel={getChannelName((config as any).discordChannelId)}
                        customMessage={(config as any).customMessage}
                        statusChip={renderChip ? renderChip(config) : undefined}
                        onEdit={() => onEdit(config)}
                        onDelete={() => onDelete(config)}
                        saving={saving}
                        darkMode={true}
                        showEdit={canEdit}
                    />
                </Grid>
            ))}
        </Grid>
    );
}
