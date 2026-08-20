import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Box, Button, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { Add, FilterAltOutlined, PauseCircleOutlined, PlayCircleOutlined, Search, SwapHoriz } from "@mui/icons-material";
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
import type { ConfigDialogItemOption } from "@/components/config-dialog/ConfigDialogFields";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

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
    itemNameSearch?: (query: string) => Promise<ConfigDialogItemOption[]>;
    allowEdit?: boolean;
    extraContent?: React.ReactNode;
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
    | "itemNameSearch"
    | "allowEdit"
    | "extraContent"
>;

function moduleDescription(moduleName: string, plural: string, t: ReturnType<typeof useDashboardI18n>["t"]): string {
    if (moduleName === "Twitch") return t("provider.twitchDescription");
    if (moduleName === "TikTok") return t("provider.tiktokDescription");
    if (moduleName === "Bluesky") return t("provider.blueskyDescription");
    if (moduleName === "YouTube") return t("provider.youtubeDescription");
    if (moduleName === "Steam News") return t("provider.steamDescription");
    if (moduleName === "Patch Notes") return t("provider.patchDescription");
    return t("provider.genericDescription", { module: moduleName, items: plural.toLowerCase() });
}

function toFeatureModule(moduleName: string): FeatureNavModule {
    if (moduleName === "Twitch" || moduleName === "TikTok" || moduleName === "Bluesky" || moduleName === "YouTube" || moduleName === "Steam News" || moduleName === "Patch Notes" || moduleName === "Anime" || moduleName === "Birthdays") {
        return moduleName;
    }
    return "Twitch";
}

function localizedModuleName(moduleName: string, t: ReturnType<typeof useDashboardI18n>["t"]): string {
    if (moduleName === "Twitch") return t("featureNav.twitch");
    if (moduleName === "TikTok") return t("featureNav.tiktok");
    if (moduleName === "Bluesky") return t("featureNav.bluesky");
    if (moduleName === "YouTube") return t("featureNav.youtube");
    if (moduleName === "Steam News") return t("featureNav.steamNews");
    if (moduleName === "Patch Notes") return t("featureNav.patchNotes");
    if (moduleName === "Anime") return t("featureNav.anime");
    if (moduleName === "Birthdays") return t("featureNav.birthdays");
    return moduleName;
}

const statusFilterOptions: Array<{ labelKey: "status.all" | "status.active" | "common.paused" | "common.healthy" | "common.warning" | "status.error" | "common.unknown"; value: NotificationConfigStatusFilter }> = [
    { labelKey: "status.all", value: "all" },
    { labelKey: "status.active", value: "active" },
    { labelKey: "common.paused", value: "paused" },
    { labelKey: "common.healthy", value: "healthy" },
    { labelKey: "common.warning", value: "warning" },
    { labelKey: "status.error", value: "error" },
    { labelKey: "common.unknown", value: "unknown" },
];

export default function NotificationConfigPage<T extends StreamingConfig>(props: NotificationConfigPageProps<T>) {
    return (
        <Suspense fallback={<DashboardLayout guild={props.guild} currentModule={props.moduleName.toLowerCase()} maxWidth="xl" loading>{null}</DashboardLayout>}>
            <NotificationConfigContent {...props} />
        </Suspense>
    );
}

function NotificationConfigContent<T extends StreamingConfig>({
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
    itemNameSearch,
    allowEdit = true,
    extraContent,
}: NotificationConfigPageProps<T>) {
    const { t } = useDashboardI18n();
    const { channels, loading: loadingChannels, getChannelName, refetch: refetchChannels } = useGuildChannels(guildId, { enabled: Boolean(guild) });
    const health = useIntegrationHealth(guildId, provider, { enabled: Boolean(guild && provider) });
    const searchParams = useSearchParams();
    const searchParamString = searchParams?.toString() ?? "";
    const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
    const [statusFilter, setStatusFilter] = useState<NotificationConfigStatusFilter>(() => parseStatusFilter(searchParams?.get("status") ?? null));
    const [bulkChannelId, setBulkChannelId] = useState("");
    const [bulkMoving, setBulkMoving] = useState(false);

    const singular = itemSingularLabel ?? (moduleName === "YouTube" ? t("config.channel") : t("config.streamer"));
    const plural = itemPluralLabel ?? (moduleName === "YouTube" ? t("config.channels") : t("config.streamers"));
    const displayModuleName = localizedModuleName(moduleName, t);
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
    const bulkMoveTargets = useMemo(() => {
        if (!bulkChannelId) return [];
        return filteredConfigs.filter((config) => String((config as Record<string, unknown>)[channelNameField] ?? "") !== bulkChannelId);
    }, [bulkChannelId, channelNameField, filteredConfigs]);

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

    useEffect(() => {
        const params = new URLSearchParams(searchParamString);
        setQuery(params.get("q") ?? "");
        setStatusFilter(parseStatusFilter(params.get("status")));
    }, [searchParamString]);

    const handleEditConfigChange = (field: string, value: any) => {
        if (!editingConfig) return;
        setEditingConfig((current) => current ? {
            ...(current as any),
            [field]: value
        } : current);
    };
    const handleRefreshChannels = () => refetchChannels({ refresh: true });

    const handleBulkMoveChannel = async () => {
        if (!bulkChannelId) {
            onSetError(t("notifications.destinationRequired"));
            return;
        }
        if (bulkMoveTargets.length === 0) {
            onSetError(t("notifications.nothingToMove"));
            return;
        }
        const channelLabel = getChannelName(bulkChannelId);
        if (!window.confirm(t("notifications.moveConfirmation", { count: bulkMoveTargets.length, module: displayModuleName, items: bulkMoveTargets.length === 1 ? singular.toLowerCase() : plural.toLowerCase(), channel: channelLabel }))) return;

        try {
            setBulkMoving(true);
            onSetError(null);
            for (const config of bulkMoveTargets) {
                const updated = {
                    ...(config as Record<string, unknown>),
                    [channelNameField]: bulkChannelId,
                } as unknown as T;
                const ok = await onUpdate(updated);
                if (!ok) return;
            }
            setBulkChannelId("");
        } finally {
            setBulkMoving(false);
        }
    };

    const currentTrail = guild ? [
        { label: t("common.settings"), href: `/dashboard/settings/${encodeURIComponent(guild.id)}` },
        { label: t("notifications.back"), href: `/dashboard/settings/${encodeURIComponent(guild.id)}/notifications` },
        { label: displayModuleName, href: null }
    ] : null;

    return (
        <DashboardLayout guild={guild} currentModule={moduleName.toLowerCase()} currentTrail={currentTrail as any} maxWidth="xl" loading={loading}>
            {!loading && guild && (
                <FeatureShell accent={moduleColor} secondaryAccent={dashboardAccents.settings}>
                    <FeatureHero
                        icon={moduleIcon}
                        eyebrow={displayModuleName}
                        title={moduleTitle}
                        description={moduleDescription(moduleName, plural, t)}
                        accent={moduleColor}
                        secondaryAccent={dashboardAccents.settings}
                        stats={[{ label: t("notifications.configured", { items: plural }), value: configs.length }]}
                        actions={(
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: { xs: "flex-start", lg: "flex-end" }, flexWrap: "wrap", rowGap: 1 }}>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodeURIComponent(guildId)}/notifications`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(moduleColor)}
                                >
                                    {t("notifications.back")}
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    onClick={() => setAddDialogOpen(true)}
                                    disabled={saving}
                                    sx={primaryActionButtonSx(moduleColor)}
                                >
                                    {t("notifications.add", { item: singular })}
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
                                    {t("notifications.configuredItems", { module: displayModuleName, items: plural })}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                                    {filtersActive
                                        ? t("notifications.shown", { shown: filteredConfigs.length, total: configs.length })
                                        : t("notifications.editHelp")}
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
                                            {t("notifications.pauseActive", { count: activeCount })}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<PlayCircleOutlined />}
                                            onClick={() => void onSetAllPaused(false)}
                                            disabled={saving || pausedCount === 0}
                                            sx={ghostActionButtonSx(moduleColor)}
                                        >
                                            {t("notifications.resumePaused", { count: pausedCount })}
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
                                    {t("notifications.add", { item: singular })}
                                </Button>
                            </Stack>
                        </Box>

                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 3 }}>
                            <TextField
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t("notifications.search", { items: plural.toLowerCase() })}
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
                                label={t("common.status")}
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
                                        {t(option.labelKey)}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Stack>

                        {allowEdit ? (
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 0.8fr) auto" },
                                    gap: 1.5,
                                    alignItems: "center",
                                    mb: 3,
                                    p: 1.5,
                                    borderRadius: 2,
                                    bgcolor: "rgba(255,255,255,0.045)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                }}
                            >
                                <TextField
                                    select
                                    label={t("notifications.moveVisible")}
                                    value={bulkChannelId}
                                    onChange={(event) => setBulkChannelId(event.target.value)}
                                    size="small"
                                    disabled={loadingChannels || saving || bulkMoving}
                                    sx={filterFieldSx(moduleColor)}
                                >
                                    <MenuItem value="">{t("notifications.chooseChannel")}</MenuItem>
                                    {channels.map((channel) => (
                                        <MenuItem key={channel.id} value={channel.id}>#{channel.name}</MenuItem>
                                    ))}
                                </TextField>
                                <Button
                                    variant="outlined"
                                    startIcon={<SwapHoriz />}
                                    disabled={saving || bulkMoving || !bulkChannelId || bulkMoveTargets.length === 0}
                                    onClick={() => void handleBulkMoveChannel()}
                                    sx={ghostActionButtonSx(moduleColor)}
                                >
                                    {bulkMoving ? t("notifications.moving") : t("notifications.moveVisibleCount", { count: bulkMoveTargets.length })}
                                </Button>
                            </Box>
                        ) : null}

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
                            moduleDisplayName={displayModuleName}
                            moduleColor={moduleColor}
                            saving={saving}
                            emptyStateIcon={moduleIcon as React.ReactElement}
                            renderChip={renderChip}
                            healthByConfigId={health.byConfigId}
                            healthLoading={health.loading}
                            itemSingularLabel={singular}
                            itemPluralLabel={plural}
                            canEdit={allowEdit}
                            emptyTitle={filtersActive
                                ? t("notifications.noMatches", { module: displayModuleName, items: plural })
                                : t("notifications.noConfigured", { module: displayModuleName, items: plural.toLowerCase() })}
                            emptyDescription={filtersActive
                                ? t("notifications.adjustFilters")
                                : t("notifications.addFirst", { module: displayModuleName, item: singular.toLowerCase() })}
                        />
                    </FeaturePanel>

                    {extraContent}

                    <AddConfigDialog
                        open={addDialogOpen}
                        onClose={() => setAddDialogOpen(false)}
                        onAdd={onAdd}
                        channelNameField={channelNameField}
                        channelNameLabel={channelNameLabel}
                        channelNamePlaceholder={channelNamePlaceholder}
                        guildId={guildId as string}
                        moduleName={moduleName}
                        moduleDisplayName={displayModuleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        onRefreshChannels={handleRefreshChannels}
                        saving={saving}
                        showCustomMessage={showCustomMessage}
                        showNotificationControls={showNotificationControls}
                        itemSingularLabel={singular}
                        itemNameOptions={itemNameOptions}
                        itemNameSearch={itemNameSearch}
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
                        moduleDisplayName={displayModuleName}
                        moduleColor={moduleColor}
                        channels={channels}
                        loadingChannels={loadingChannels}
                        onRefreshChannels={handleRefreshChannels}
                        saving={saving}
                        itemSingularLabel={singular}
                        showCustomMessage={showCustomMessage}
                        showNotificationControls={showNotificationControls}
                        itemNameOptions={itemNameOptions}
                        itemNameSearch={itemNameSearch}
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

function parseStatusFilter(value: string | null): NotificationConfigStatusFilter {
    const normalized = String(value ?? "");
    return statusFilterOptions.some((option) => option.value === normalized)
        ? normalized as NotificationConfigStatusFilter
        : "all";
}
