"use client";
import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { AlternateEmail, AutoStories, Cake, Download, LiveTv, NotificationsActive, Search, SpeakerNotes, SportsEsports, UploadFile, YouTube as YouTubeIcon } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureCard } from "@/components/dashboard/FeatureCard";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";
import { useSteamNewsConfigs } from "@/components/hooks/useSteamNews";
import { useTikTokConfigs } from "@/components/hooks/useTikTok";
import { useBlueskyConfigs } from "@/components/hooks/useBluesky";
import { useBirthdays } from "@/components/hooks/useBirthdays";
import { useAnimeConfigs } from "@/components/hooks/useAnime";
import { SetupTemplatesPanel } from "@/components/notifications/SetupTemplatesPanel";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { buildNotificationSetupReview, type NotificationSetupReview, type NotificationReviewGroup, type NotificationChannelLoad } from "@/lib/notificationSetupReview";
import { buildNotificationSetupExport, buildNotificationSetupExportFilename } from "@/lib/notificationSetupExport";
import { buildNotificationChannelLinks, buildNotificationReviewGroupLink, type NotificationSetupLink } from "@/lib/notificationSetupLinks";
import {
    buildNotificationSetupImportCreatePayload,
    buildNotificationSetupImportPlan,
    parseNotificationSetupImportJson,
    type NotificationSetupImportItem,
    type NotificationSetupImportPlan,
    type NotificationSetupImportSkippedItem,
} from "@/lib/notificationSetupImport";
import { api } from "@/lib/api-client";
import type { DashboardLocale } from "@/lib/i18n/localeStore";

export default function GuildNotificationsHubPage() {
    const { locale, t, formatNumber } = useDashboardI18n();
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const guildReady = Boolean(guild);
    const twitchApi = useTwitchConfigs(guildId as string);
    const youtubeApi = useYouTubeConfigs(guildId as string);
    const steamNewsApi = useSteamNewsConfigs(guildId as string);
    const patchApi = usePatchSubscriptions(guildId as string);
    const tiktokApi = useTikTokConfigs(guildId as string);
    const blueskyApi = useBlueskyConfigs(guildId as string);
    const birthdayApi = useBirthdays(guildId as string, { enabled: guildReady });
    const animeApi = useAnimeConfigs(guildId as string, { enabled: guildReady });
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const [importPlan, setImportPlan] = useState<NotificationSetupImportPlan | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    const loading = guildsLoading || twitchApi.loading || youtubeApi.loading || steamNewsApi.loading || patchApi.loading || tiktokApi.loading || blueskyApi.loading || birthdayApi.loading || animeApi.loading;
    const totalConfigured = twitchApi.configs.length + tiktokApi.configs.length + blueskyApi.configs.length + youtubeApi.configs.length + steamNewsApi.configs.length + patchApi.configs.length + animeApi.configs.length + birthdayApi.birthdays.length;
    const encodedGuildId = encodeURIComponent(guildId as string);
    const notificationRecords = useMemo(() => ({
        twitch: asReviewRecords(twitchApi.configs),
        youtube: asReviewRecords(youtubeApi.configs),
        tiktok: asReviewRecords(tiktokApi.configs),
        bluesky: asReviewRecords(blueskyApi.configs),
        steamNews: asReviewRecords(steamNewsApi.configs),
        patchNotes: asReviewRecords(patchApi.configs),
        anime: asReviewRecords(animeApi.configs),
        birthdays: asReviewRecords(birthdayApi.birthdays),
    }), [
        twitchApi.configs,
        youtubeApi.configs,
        tiktokApi.configs,
        blueskyApi.configs,
        steamNewsApi.configs,
        patchApi.configs,
        animeApi.configs,
        birthdayApi.birthdays,
    ]);
    const setupReview = useMemo(() => buildNotificationSetupReview({
        ...notificationRecords,
    }, locale), [locale, notificationRecords]);
    const setupExport = useMemo(() => buildNotificationSetupExport({
        guildId: guildId as string,
        review: setupReview,
        ...notificationRecords,
    }), [guildId, notificationRecords, setupReview]);

    const handleExportSetup = () => {
        downloadJson(buildNotificationSetupExportFilename(guildId as string), setupExport);
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (!file) return;

        try {
            setImportError(null);
            setImportResult(null);
            const text = await file.text();
            const exportPayload = parseNotificationSetupImportJson(text, locale);
            setImportPlan(buildNotificationSetupImportPlan({
                exportPayload,
                currentGuildId: guildId as string,
                currentRecords: setupExport.records,
            }, locale));
        } catch (err) {
            setImportPlan(null);
            setImportError(err instanceof Error ? err.message : t("notificationsHub.importReadFailed"));
        }
    };

    const handleImportMissing = async () => {
        if (!importPlan || importPlan.ready.length === 0) return;

        try {
            setImporting(true);
            setImportError(null);
            setImportResult(null);

            for (const item of importPlan.ready) {
                await restoreNotificationRecord(guildId as string, item, locale);
            }

            await Promise.all([
                twitchApi.refreshConfigs(),
                youtubeApi.refreshConfigs(),
                steamNewsApi.refreshConfigs(),
                patchApi.refreshConfigs(),
                tiktokApi.refreshConfigs(),
                blueskyApi.refreshConfigs(),
                animeApi.refreshConfigs(),
                birthdayApi.refresh(),
            ]);
            setImportResult(importPlan.ready.length === 1
                ? t("notificationsHub.importedOne")
                : t("notificationsHub.imported", { count: formatNumber(importPlan.ready.length) }));
            setImportPlan(null);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : t("notificationsHub.importFailed"));
        } finally {
            setImporting(false);
        }
    };

    const refreshNotificationConfigLists = async () => {
        await Promise.all([
            twitchApi.refreshConfigs(),
            youtubeApi.refreshConfigs(),
            steamNewsApi.refreshConfigs(),
            patchApi.refreshConfigs(),
            tiktokApi.refreshConfigs(),
            blueskyApi.refreshConfigs(),
            animeApi.refreshConfigs(),
            birthdayApi.refresh(),
        ]);
    };

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const cards = [
        {
            title: t("notificationsHub.twitchTitle"),
            description: t("notificationsHub.twitchDescription"),
            icon: <LiveTv />,
            accent: dashboardAccents.twitch,
            href: `/dashboard/twitch/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(twitchApi.configs.length) }),
            actionLabel: t("notificationsHub.twitchAction"),
        },
        {
            title: t("notificationsHub.tiktokTitle"),
            description: t("notificationsHub.tiktokDescription"),
            icon: <LiveTv />,
            accent: dashboardAccents.tiktok,
            href: `/dashboard/tiktok/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(tiktokApi.configs.length) }),
            actionLabel: t("notificationsHub.tiktokAction"),
        },
        {
            title: t("notificationsHub.blueskyTitle"),
            description: t("notificationsHub.blueskyDescription"),
            icon: <AlternateEmail />,
            accent: dashboardAccents.bluesky,
            href: `/dashboard/bluesky/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(blueskyApi.configs.length) }),
            actionLabel: t("notificationsHub.blueskyAction"),
        },
        {
            title: t("notificationsHub.youtubeTitle"),
            description: t("notificationsHub.youtubeDescription"),
            icon: <YouTubeIcon />,
            accent: dashboardAccents.youtube,
            href: `/dashboard/youtube/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(youtubeApi.configs.length) }),
            actionLabel: t("notificationsHub.youtubeAction"),
        },
        {
            title: t("notificationsHub.steamTitle"),
            description: t("notificationsHub.steamDescription"),
            icon: <SportsEsports />,
            accent: dashboardAccents.steam,
            href: `/dashboard/steam-news/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(steamNewsApi.configs.length) }),
            actionLabel: t("notificationsHub.steamAction"),
        },
        {
            title: t("notificationsHub.patchTitle"),
            description: t("notificationsHub.patchDescription"),
            icon: <SpeakerNotes />,
            accent: dashboardAccents.patchNotes,
            href: `/dashboard/patch-notes/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(patchApi.configs.length) }),
            actionLabel: t("notificationsHub.patchAction"),
        },
        {
            title: t("notificationsHub.animeTitle"),
            description: t("notificationsHub.animeDescription"),
            icon: <AutoStories />,
            accent: dashboardAccents.anime,
            href: `/dashboard/anime/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(animeApi.configs.length) }),
            actionLabel: t("notificationsHub.animeAction"),
        },
        {
            title: t("notificationsHub.birthdayTitle"),
            description: t("notificationsHub.birthdayDescription"),
            icon: <Cake />,
            accent: dashboardAccents.birthdays,
            href: `/dashboard/birthdays/${encodedGuildId}`,
            chipLabel: t("notificationsHub.configuredCount", { count: formatNumber(birthdayApi.birthdays.length) }),
            actionLabel: t("notificationsHub.birthdayAction"),
        },
    ];

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={loading}>
            {!loading && guild && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
                    <FeatureHero
                        icon={<NotificationsActive />}
                        eyebrow={t("notificationsHub.eyebrow")}
                        title={t("notificationsHub.title")}
                        description={t("notificationsHub.description")}
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.anime}
                        stats={[{ label: t("notificationsHub.configuredFeeds"), value: formatNumber(totalConfigured) }]}
                        actions={(
                            <Stack id="notification-transfer" direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1, scrollMarginTop: 96 }}>
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept="application/json,.json"
                                    hidden
                                    onChange={(event) => {
                                        void handleImportFile(event);
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<UploadFile />}
                                    onClick={() => importInputRef.current?.click()}
                                    disabled={importing}
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    {t("notificationsHub.importJson")}
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Download />}
                                    onClick={handleExportSetup}
                                    disabled={totalConfigured === 0}
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    {t("notificationsHub.exportJson")}
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodedGuildId}`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    {t("notificationsHub.backSettings")}
                                </Button>
                            </Stack>
                        )}
                    />

                    <FeaturePanel accent={dashboardAccents.settings}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {cards.map((card) => (
                                <FeatureCard key={card.title} {...card} statusLabel={t("notificationsHub.active")} />
                            ))}
                        </Box>
                    </FeaturePanel>

                    <SetupTemplatesPanel
                        guildId={guildId as string}
                        onApplied={refreshNotificationConfigLists}
                    />

                    {(importPlan || importError || importResult) && (
                        <ImportPreviewPanel
                            plan={importPlan}
                            error={importError}
                            result={importResult}
                            importing={importing}
                            onImport={() => {
                                void handleImportMissing();
                            }}
                        />
                    )}

                    <SetupReviewPanel review={setupReview} guildId={guildId as string} />
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function ImportPreviewPanel({
    plan,
    error,
    result,
    importing,
    onImport,
}: {
    plan: NotificationSetupImportPlan | null;
    error: string | null;
    result: string | null;
    importing: boolean;
    onImport: () => void;
}) {
    const { t, formatNumber } = useDashboardI18n();
    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            {t("notificationsHub.previewTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            {t("notificationsHub.previewDescription")}
                        </Typography>
                    </Box>
                    {plan && (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                            <Chip label={t("notificationsHub.readyCount", { count: formatNumber(plan.totals.ready) })} color={plan.totals.ready > 0 ? "success" : "default"} variant="outlined" />
                            <Chip label={t("notificationsHub.skippedCount", { count: formatNumber(plan.skipped.length) })} color={plan.skipped.length > 0 ? "warning" : "default"} variant="outlined" />
                        </Stack>
                    )}
                </Box>

                {error && (
                    <Alert severity="error" sx={{ bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }}>
                        {error}
                    </Alert>
                )}
                {result && (
                    <Alert severity="success" sx={{ bgcolor: "rgba(75, 222, 128, 0.12)", color: "grey.50", border: "1px solid rgba(75, 222, 128, 0.24)" }}>
                        {result}
                    </Alert>
                )}

                {plan && (
                    <>
                        {plan.warnings.map((warning) => (
                            <Alert key={warning} severity="warning" sx={{ bgcolor: "rgba(255,179,71,0.12)", color: "grey.50", border: "1px solid rgba(255,179,71,0.24)" }}>
                                {warning}
                            </Alert>
                        ))}

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                            <ImportItemSection title={t("notificationsHub.readyTitle")} items={plan.ready} emptyText={t("notificationsHub.noReady")} />
                            <ImportSkippedSection items={plan.skipped} />
                        </Box>

                        <Box>
                            <Button
                                variant="contained"
                                startIcon={<UploadFile />}
                                onClick={onImport}
                                disabled={importing || plan.ready.length === 0}
                                sx={{
                                    bgcolor: dashboardAccents.settings,
                                    color: "#050816",
                                    fontWeight: 850,
                                    "&:hover": { bgcolor: dashboardAccents.settings },
                                }}
                            >
                                {importing
                                    ? t("notificationsHub.importing")
                                    : t("notificationsHub.importMissing", { count: formatNumber(plan.ready.length) })}
                            </Button>
                        </Box>
                    </>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ImportItemSection({ title, items, emptyText }: { title: string; items: NotificationSetupImportItem[]; emptyText: string }) {
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {title}
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    {emptyText}
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <ImportLine key={item.key} primary={`${item.record.provider}: ${item.record.source}`} secondary={item.record.channelId} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

function ImportSkippedSection({ items }: { items: NotificationSetupImportSkippedItem[] }) {
    const { t } = useDashboardI18n();
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {t("notificationsHub.skippedTitle")}
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    {t("notificationsHub.noSkipped")}
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <ImportLine
                            key={`${item.reason}:${item.key}`}
                            primary={`${item.record.provider}: ${item.record.source}`}
                            secondary={`${item.message} ${t("notificationsHub.channel", { channel: item.record.channelId })}`}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}

function ImportLine({ primary, secondary }: { primary: string; secondary: string }) {
    return (
        <Box sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 1.5, px: 1.25, py: 1, bgcolor: "rgba(255,255,255,0.035)" }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750 }}>
                {primary}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
                {secondary}
            </Typography>
        </Box>
    );
}

function SetupReviewPanel({ review, guildId }: { review: NotificationSetupReview; guildId: string }) {
    const { t, formatNumber } = useDashboardI18n();
    const totalFindings = review.duplicateRoutes.length + review.multiChannelFeeds.length + review.busyChannels.length;

    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            {t("notificationsHub.reviewTitle")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            {t("notificationsHub.reviewDescription")}
                        </Typography>
                    </Box>
                    <Chip
                        label={totalFindings === 0
                            ? t("notificationsHub.noFindings")
                            : totalFindings === 1
                                ? t("notificationsHub.findingOne")
                                : t("notificationsHub.findingMany", { count: formatNumber(totalFindings) })}
                        color={totalFindings === 0 ? "success" : "warning"}
                        variant="outlined"
                    />
                </Box>

                {totalFindings === 0 ? (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                        {t("notificationsHub.reviewClean")}
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        <ReviewGroupSection title={t("notificationsHub.duplicateRoutes")} groups={review.duplicateRoutes} guildId={guildId} />
                        <ReviewGroupSection title={t("notificationsHub.multiChannel")} groups={review.multiChannelFeeds} guildId={guildId} />
                        <BusyChannelSection channels={review.busyChannels} guildId={guildId} />
                    </Stack>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ReviewGroupSection({ title, groups, guildId }: { title: string; groups: NotificationReviewGroup[]; guildId: string }) {
    const { locale, t, formatNumber } = useDashboardI18n();
    if (groups.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {title}
            </Typography>
            <Stack spacing={0.75}>
                {groups.slice(0, 5).map((group) => (
                    <ReviewLine
                        key={group.key}
                        primary={`${group.provider}: ${group.sourceLabel}`}
                        secondary={t("notificationsHub.routeSummary", {
                            routes: formatNumber(group.records.length),
                            channels: formatNumber(group.channelIds.length),
                            ids: group.channelIds.join(", "),
                        })}
                        actions={toReviewActions(buildNotificationReviewGroupLink(guildId, group, locale))}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function BusyChannelSection({ channels, guildId }: { channels: NotificationChannelLoad[]; guildId: string }) {
    const { locale, t, formatNumber } = useDashboardI18n();
    if (channels.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                {t("notificationsHub.busyChannels")}
            </Typography>
            <Stack spacing={0.75}>
                {channels.slice(0, 5).map((channel) => (
                    <ReviewLine
                        key={channel.channelId}
                        primary={channel.channelId}
                        secondary={t("notificationsHub.busySummary", {
                            count: formatNumber(channel.count),
                            providers: channel.providers.join(", "),
                        })}
                        actions={toReviewActions(buildNotificationChannelLinks(guildId, channel, locale))}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function ReviewLine({ primary, secondary, actions }: { primary: string; secondary: string; actions?: React.ReactNode }) {
    return (
        <Box sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 1.5, px: 1.25, py: 1, bgcolor: "rgba(255,255,255,0.035)" }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750 }}>
                {primary}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
                {secondary}
            </Typography>
            {actions && (
                <Box sx={{ mt: 0.75 }}>
                    {actions}
                </Box>
            )}
        </Box>
    );
}

function toReviewActions(links: NotificationSetupLink | NotificationSetupLink[] | null): React.ReactNode {
    if (!links) return undefined;
    const normalizedLinks = Array.isArray(links) ? links : [links];
    if (normalizedLinks.length === 0) return undefined;

    return (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
            {normalizedLinks.map((link) => (
                <Button
                    key={link.href}
                    component={Link}
                    href={link.href}
                    size="small"
                    startIcon={<Search fontSize="small" />}
                    sx={{
                        color: dashboardAccents.settings,
                        fontWeight: 800,
                        minWidth: 0,
                        px: 0.75,
                        py: 0.25,
                        textTransform: "none",
                    }}
                >
                    {link.label}
                </Button>
            ))}
        </Stack>
    );
}

function asReviewRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
}

function downloadJson(filename: string, value: unknown): void {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

async function restoreNotificationRecord(
    guildId: string,
    item: NotificationSetupImportItem,
    locale: DashboardLocale,
): Promise<void> {
    const create = buildNotificationSetupImportCreatePayload(guildId, item.record, locale);
    if (create.provider === "Twitch") {
        await api.createTwitchStream(create.payload as Parameters<typeof api.createTwitchStream>[0]);
        return;
    }
    if (create.provider === "YouTube") {
        await api.createYouTubeChannel(create.payload as Parameters<typeof api.createYouTubeChannel>[0]);
        return;
    }
    if (create.provider === "TikTok") {
        await api.createTikTokStream(create.payload as Parameters<typeof api.createTikTokStream>[0]);
        return;
    }
    if (create.provider === "Bluesky") {
        await api.createBlueskyAccount(create.payload as Parameters<typeof api.createBlueskyAccount>[0]);
        return;
    }
    if (create.provider === "Patch Notes") {
        await api.createPatchSubscription(create.payload as Parameters<typeof api.createPatchSubscription>[0]);
        return;
    }
    if (create.provider === "Steam News") {
        await api.createSteamNewsSubscription(create.payload as Parameters<typeof api.createSteamNewsSubscription>[0]);
        return;
    }
    if (create.provider === "Anime") {
        await api.createAnimeSubscription(create.payload as Parameters<typeof api.createAnimeSubscription>[0]);
        if (item.record.paused) {
            const anilistId = Number(create.payload.anilistId);
            const subscriptions = await api.getAnimeSubscriptions(guildId);
            const restored = subscriptions.find((subscription) => (
                subscription.anilistId === anilistId
                && (subscription.channelId ?? subscription.discordChannelId) === item.record.channelId
            ));
            if (restored?.id) {
                await api.setAnimeSubscriptionPaused(restored.id, true);
            }
        }
        return;
    }
    if (create.provider === "Birthdays") {
        await api.createBirthday(create.payload as unknown as Parameters<typeof api.createBirthday>[0]);
    }
}
