import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Add, FilterAltOutlined, PauseCircleOutlined, PlayCircleOutlined, Search } from "@mui/icons-material";
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
import { filterNotificationConfigs, type NotificationConfigStatusFilter } from "@/lib/notificationConfigFilters";

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
    onTogglePaused?: (config: T) => Promise<boolean>;
    onSetAllPaused?: (paused: boolean) => Promise<boolean>;

    renderChip?: (config: T) => {
        label: string;
        color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
        variant?: "filled" | "outlined";
    } | undefined;

    itemSingularLabel?: string;
    itemPluralLabel?: string;
    showCustomMessage?: boolean;
    showNotificationControls?: boolean;
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
    | "showNotificationControls"
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

const statusFilterOptions: Array<{ label: string; value: NotificationConfigStatusFilter }> = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Paused", value: "paused" },
    { label: "Healthy", value: "healthy" },
    { label: "Warning", value: "warning" },
    { label: "Error", value: "error" },
    { label: "Unknown", value: "unknown" },
];

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
    onTogglePaused,
    onSetAllPaused,
    renderChip,
    itemSingularLabel,
    itemPluralLabel,
    showCustomMessage = true,
    showNotificationControls = true,
    itemNameOptions,
    allowEdit = true,
}: NotificationConfigPageProps<T>) {
    const { channels, loading: loadingChannels, getChannelName } = useGuildChannels(guildId, { enabled: Boolean(guild) });
    const health = useIntegrationHealth(guildId, provider, { enabled: Boolean(guild && provider) });
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<NotificationConfigStatusFilter>("all");

    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? "Channel" : "Streamer");
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? "Channels" : "Streamers");
    const pausedCount = configs.filter((config) => Boolean(config.paused)).length;
    const activeCount = configs.length - pausedCount;
    const filtersActive = query.trim().length > 0 || statusFilter !== "all";
    const filteredConfigs = useMemo(() => filterNotificationConfigs({
        configs,
        channelNameField,
        getChannelName,
        healthByConfigId: health.byConfigId,
        query,
        status: statusFilter,
    }), [configs, channelNameField, getChannelName, health.byConfigId, query, statusFilter]);

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
                                    {filtersActive
                                        ? `${filteredConfigs.length} of ${configs.length} shown.`
                                        : "Edit destinations, messages, cooldowns, and quiet hours from one place."}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                {onSetAllPaused && (
                                    <>
                                        <Button
                                            variant="outlined"
                                            startIcon={<PauseCircleOutlined />}
                                            onClick={() => void onSetAllPaused(true)}
                                            disabled={saving || activeCount === 0}
                                            sx={ghostActionButtonSx(moduleColor)}
                                        >
                                            Pause Active ({activeCount})
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<PlayCircleOutlined />}
                                            onClick={() => void onSetAllPaused(false)}
                                            disabled={saving || pausedCount === 0}
                                            sx={ghostActionButtonSx(moduleColor)}
                                        >
                                            Resume Paused ({pausedCount})
                                        </Button>
                                    </>
                                )}
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
                        </Box>

                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 3 }}>
                            <TextField
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={`Search ${plural.toLowerCase()}`}
                                size="small"
                                sx={{ flex: 1, minWidth: { xs: "100%", md: 280 }, ...filterFieldSx(moduleColor) }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search fontSize="small" sx={{ color: "rgba(255,255,255,0.62)" }} />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />
                            <TextField
                                select
                                label="Status"
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as NotificationConfigStatusFilter)}
                                size="small"
                                sx={{ minWidth: { xs: "100%", md: 180 }, ...filterFieldSx(moduleColor) }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <FilterAltOutlined fontSize="small" sx={{ color: "rgba(255,255,255,0.62)" }} />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            >
                                {statusFilterOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        <NotificationConfigList
                            configs={filteredConfigs}
                            channelNameField={channelNameField}
                            channelNameLabel={channelNameLabel}
                            getChannelName={getChannelName}
                            onEdit={setEditingConfig as any}
                            onDelete={handleDeleteConfig}
                            onTogglePaused={onTogglePaused ? (config) => {
                                void onTogglePaused(config);
                            } : undefined}
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
                            emptyTitle={filtersActive ? `No Matching ${moduleName} ${plural}` : undefined}
                            emptyDescription={filtersActive ? "Adjust the search or status filter to show more configurations." : undefined}
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
                        showNotificationControls={showNotificationControls}
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
                        showNotificationControls={showNotificationControls}
                        itemNameOptions={itemNameOptions}
                    />
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function filterFieldSx(accent: string) {
    return {
        "& .MuiInputBase-root": {
            bgcolor: "rgba(255,255,255,0.05)",
            color: "grey.50",
            borderRadius: 1.5,
        },
        "& .MuiInputLabel-root": {
            color: "rgba(255,255,255,0.62)",
        },
        "& .MuiInputLabel-root.Mui-focused": {
            color: accent,
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255,255,255,0.16)",
        },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255,255,255,0.32)",
        },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: accent,
        },
        "& .MuiSelect-icon": {
            color: "rgba(255,255,255,0.62)",
        },
    };
}
