import React from "react";
import Link from "next/link";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import AddConfigDialog from "@/components/AddConfigDialog";
import EditConfigDialog from "@/components/EditConfigDialog";
import NotificationConfigList from "@/components/NotificationConfigList";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureNav, type FeatureNavModule } from "@/components/dashboard/FeatureNav";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useStreamingForm, type StreamingConfig } from "@/components/hooks/useStreamingForm";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useIntegrationHealth } from "@/components/hooks/useIntegrationHealth";

interface NotificationConfigPageProps<T extends StreamingConfig> {
    guildId: string;
    guild: any;
    configs: T[];
    loading: boolean;
    saving: boolean;
    error: string | null;
    moduleTitle: string;
    moduleIcon: React.ReactNode;
    moduleColor: string;
    moduleName: string;
    provider?: string;
    channelNameField: string;
    channelNameLabel: string;
    channelNamePlaceholder: string;

    onSetError: (error: string | null) => void;
    onAdd: (config: Omit<T, 'id' | 'guildId'>) => Promise<boolean>;
    onUpdate: (config: T) => Promise<boolean>;
    onDelete: (config: T) => Promise<boolean>;

    renderChip?: (config: T) => {
        label: string;
        color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
        variant?: "filled" | "outlined";
    } | undefined;

    itemSingularLabel?: string;
    itemPluralLabel?: string;
    showCustomMessage?: boolean;
    itemNameOptions?: string[];
    allowEdit?: boolean;
}

export type NotificationConfigPageOptions<T extends StreamingConfig> = Pick<
    NotificationConfigPageProps<T>,
    | "moduleTitle"
    | "moduleIcon"
    | "moduleColor"
    | "moduleName"
    | "provider"
    | "channelNameField"
    | "channelNameLabel"
    | "channelNamePlaceholder"
    | "renderChip"
    | "itemSingularLabel"
    | "itemPluralLabel"
    | "showCustomMessage"
    | "itemNameOptions"
    | "allowEdit"
>;

function moduleDescription(moduleName: string, plural: string): string {
    if (moduleName === "Twitch") return "Track live streams, route announcements to the right channel, and tune cooldowns or quiet hours.";
    if (moduleName === "TikTok") return "Track creators going live and keep noisy alerts under control with per-channel notification settings.";
    if (moduleName === "Bluesky") return "Watch Bluesky accounts for new posts and route announcements with cooldowns and quiet hours.";
    if (moduleName === "YouTube") return "Watch channels for new uploads and post clean video announcements where your server expects them.";
    if (moduleName === "Patch Notes") return "Subscribe Discord channels to game update feeds so patch posts land in predictable places.";
    return `Configure ${moduleName} ${plural.toLowerCase()} for this server.`;
}

function toFeatureModule(moduleName: string): FeatureNavModule {
    if (moduleName === "Twitch" || moduleName === "TikTok" || moduleName === "Bluesky" || moduleName === "YouTube" || moduleName === "Patch Notes" || moduleName === "Anime" || moduleName === "Birthdays") {
        return moduleName;
    }
    return "Twitch";
}

export default function NotificationConfigPage<T extends StreamingConfig>({
    guildId,
    guild,
    configs,
    loading,
    saving,
    error,
    moduleTitle,
    moduleIcon,
    moduleColor,
    moduleName,
    provider,
    channelNameField,
    channelNameLabel,
    channelNamePlaceholder,
    onSetError,
    onAdd,
    onUpdate,
    onDelete,
    renderChip,
    itemSingularLabel,
    itemPluralLabel,
    showCustomMessage = true,
    itemNameOptions,
    allowEdit = true,
}: NotificationConfigPageProps<T>) {
    const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId, { enabled: Boolean(guild) });
    const health = useIntegrationHealth(guildId, provider, { enabled: Boolean(guild && provider) });

    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? "Channel" : "Streamer");
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? "Channels" : "Streamers");

    const {
        addDialogOpen,
        setAddDialogOpen,
        editingConfig,
        setEditingConfig,
        handleUpdateConfig,
        handleDeleteConfig,
    } = useStreamingForm<T>({
        onAdd,
        onUpdate,
        onDelete,
        channelNameField,
        guildId: guildId as string
    });

    const handleEditConfigChange = (field: string, value: any) => {
        if (!editingConfig) return;
        setEditingConfig({
            ...(editingConfig as any),
            [field]: value
        });
    };

    const currentTrail = guild ? [
        { label: "Settings", href: `/dashboard/settings/${encodeURIComponent(guild.id)}` },
        { label: "Notifications", href: `/dashboard/settings/${encodeURIComponent(guild.id)}/notifications` },
        { label: moduleName, href: null }
    ] : null;

    return (
        <DashboardLayout guild={guild} currentModule={moduleName.toLowerCase()} currentTrail={currentTrail as any} maxWidth="xl" loading={loading}>
            {!loading && guild && (
                <FeatureShell accent={moduleColor} secondaryAccent={dashboardAccents.settings}>
                    <FeatureHero
                        icon={moduleIcon}
                        eyebrow={moduleName}
                        title={moduleTitle}
                        description={moduleDescription(moduleName, plural)}
                        accent={moduleColor}
                        secondaryAccent={dashboardAccents.settings}
                        stats={[{ label: `${plural} Configured`, value: configs.length }]}
                        actions={(
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", lg: "flex-end" }, flexWrap: "wrap", rowGap: 1 }}>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodeURIComponent(guildId)}/notifications`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(moduleColor)}
                                >
                                    Back To Notifications
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => setAddDialogOpen(true)}
                                    disabled={saving}
                                    sx={primaryActionButtonSx(moduleColor)}
                                >
                                    Add {singular}
                                </Button>
                            </Stack>
                        )}
                        nav={<FeatureNav guildId={guildId} activeModule={toFeatureModule(moduleName)} />}
                    />

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }} onClose={() => onSetError(null)}>
                            {error}
                        </Alert>
                    )}

                    <FeaturePanel accent={moduleColor}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap", position: "relative" }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                                    Configured {moduleName} {plural}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                                    Edit destinations, messages, cooldowns, and quiet hours from one place.
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                onClick={() => setAddDialogOpen(true)}
                                disabled={saving}
                                sx={primaryActionButtonSx(moduleColor)}
                            >
                                Add {singular}
                            </Button>
                        </Box>

                        <NotificationConfigList
                            configs={configs}
                            channelNameField={channelNameField}
                            channelNameLabel={channelNameLabel}
                            getChannelName={getChannelName}
                            onEdit={setEditingConfig as any}
                            onDelete={handleDeleteConfig}
                            moduleName={moduleName}
                            moduleColor={moduleColor}
                            saving={saving}
                            emptyStateIcon={moduleIcon as React.ReactElement}
                            renderChip={renderChip}
                            healthByConfigId={health.byConfigId}
                            healthLoading={health.loading}
                            itemSingularLabel={singular}
                            itemPluralLabel={plural}
                            canEdit={allowEdit}
                        />
                    </FeaturePanel>

                    <AddConfigDialog
                        open={addDialogOpen}
                        onClose={() => setAddDialogOpen(false)}
                        onAdd={onAdd}
                        channelNameField={channelNameField}
                        channelNameLabel={channelNameLabel}
                        channelNamePlaceholder={channelNamePlaceholder}
                        guildId={guildId as string}
                        moduleName={moduleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        saving={saving}
                        showCustomMessage={showCustomMessage}
                        itemSingularLabel={singular}
                        itemNameOptions={itemNameOptions}
                    />

                    <EditConfigDialog
                        open={!!editingConfig}
                        onClose={() => setEditingConfig(null)}
                        config={editingConfig}
                        onConfigChange={handleEditConfigChange}
                        onSave={handleUpdateConfig}
                        channelNameField={channelNameField}
                        channelNameLabel={channelNameLabel}
                        moduleName={moduleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        saving={saving}
                        itemSingularLabel={singular}
                        showCustomMessage={showCustomMessage}
                        itemNameOptions={itemNameOptions}
                    />
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}
