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

export default function GuildNotificationsHubPage() {
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
    }), [notificationRecords]);
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
            const exportPayload = parseNotificationSetupImportJson(text);
            setImportPlan(buildNotificationSetupImportPlan({
                exportPayload,
                currentGuildId: guildId as string,
                currentRecords: setupExport.records,
            }));
        } catch (err) {
            setImportPlan(null);
            setImportError(err instanceof Error ? err.message : "Failed to read notification setup import.");
        }
    };

    const handleImportMissing = async () => {
        if (!importPlan || importPlan.ready.length === 0) return;

        try {
            setImporting(true);
            setImportError(null);
            setImportResult(null);

            for (const item of importPlan.ready) {
                await restoreNotificationRecord(guildId as string, item);
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
            setImportResult(`Imported ${importPlan.ready.length} missing ${importPlan.ready.length === 1 ? "route" : "routes"}.`);
            setImportPlan(null);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : "Failed to import notification setup.");
        } finally {
            setImporting(false);
        }
    };

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const cards = [
        {
            title: "Twitch Live",
            description: "Stream alerts with destination channels, custom messages, cooldowns, and quiet hours.",
            icon: <LiveTv />,
            accent: dashboardAccents.twitch,
            href: `/dashboard/twitch/${encodedGuildId}`,
            chipLabel: `${twitchApi.configs.length} Configured`,
            actionLabel: "Manage Twitch",
        },
        {
            title: "TikTok Live",
            description: "Creator live alerts using the same channel routing and notification controls as Twitch.",
            icon: <LiveTv />,
            accent: dashboardAccents.tiktok,
            href: `/dashboard/tiktok/${encodedGuildId}`,
            chipLabel: `${tiktokApi.configs.length} Configured`,
            actionLabel: "Manage TikTok",
        },
        {
            title: "Bluesky Posts",
            description: "Account post alerts with Discord channel routing, custom messages, cooldowns, and quiet hours.",
            icon: <AlternateEmail />,
            accent: dashboardAccents.bluesky,
            href: `/dashboard/bluesky/${encodedGuildId}`,
            chipLabel: `${blueskyApi.configs.length} Configured`,
            actionLabel: "Manage Bluesky",
        },
        {
            title: "YouTube Uploads",
            description: "Watch channels for new uploads and post clean video announcements to Discord.",
            icon: <YouTubeIcon />,
            accent: dashboardAccents.youtube,
            href: `/dashboard/youtube/${encodedGuildId}`,
            chipLabel: `${youtubeApi.configs.length} Configured`,
            actionLabel: "Manage YouTube",
        },
        {
            title: "Steam News",
            description: "Official Steam game announcements with destination channels, custom messages, cooldowns, and quiet hours.",
            icon: <SportsEsports />,
            accent: dashboardAccents.steam,
            href: `/dashboard/steam-news/${encodedGuildId}`,
            chipLabel: `${steamNewsApi.configs.length} Configured`,
            actionLabel: "Manage Steam",
        },
        {
            title: "Patch Notes",
            description: "Subscribe channels to game update feeds so patch posts land where people expect them.",
            icon: <SpeakerNotes />,
            accent: dashboardAccents.patchNotes,
            href: `/dashboard/patch-notes/${encodedGuildId}`,
            chipLabel: `${patchApi.configs.length} Configured`,
            actionLabel: "Manage Patch Notes",
        },
        {
            title: "Anime Episodes",
            description: "AniList search, season browsing, and channel reminders for upcoming episodes.",
            icon: <AutoStories />,
            accent: dashboardAccents.anime,
            href: `/dashboard/anime/${encodedGuildId}`,
            chipLabel: `${animeApi.configs.length} Configured`,
            actionLabel: "Manage Anime",
        },
        {
            title: "Birthday Announcements",
            description: "Member birthday announcements with member search and per-birthday destination channels.",
            icon: <Cake />,
            accent: dashboardAccents.birthdays,
            href: `/dashboard/birthdays/${encodedGuildId}`,
            chipLabel: `${birthdayApi.birthdays.length} Configured`,
            actionLabel: "Manage Birthdays",
        },
    ];

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={loading}>
            {!loading && guild && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
                    <FeatureHero
                        icon={<NotificationsActive />}
                        eyebrow="Notifications"
                        title="Notification Command Center"
                        description="One place to manage every server-facing notification feed: live streams, uploads, game news, patch notes, anime episodes, and birthday announcements."
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.anime}
                        stats={[{ label: "Configured Feeds", value: totalConfigured }]}
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
                                    Import JSON
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Download />}
                                    onClick={handleExportSetup}
                                    disabled={totalConfigured === 0}
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Export JSON
                                </Button>
                                <Button
                                    component={Link}
                                    href={`/dashboard/settings/${encodedGuildId}`}
                                    variant="outlined"
                                    sx={ghostActionButtonSx(dashboardAccents.settings)}
                                >
                                    Back To Settings
                                </Button>
                            </Stack>
                        )}
                    />

                    <FeaturePanel accent={dashboardAccents.settings}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                            {cards.map((card) => (
                                <FeatureCard key={card.title} {...card} statusLabel="active" />
                            ))}
                        </Box>
                    </FeaturePanel>

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
    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            Import Preview
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            Missing supported routes can be created without overwriting existing notification setup.
                        </Typography>
                    </Box>
                    {plan && (
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                            <Chip label={`${plan.totals.ready} ready`} color={plan.totals.ready > 0 ? "success" : "default"} variant="outlined" />
                            <Chip label={`${plan.skipped.length} skipped`} color={plan.skipped.length > 0 ? "warning" : "default"} variant="outlined" />
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
                            <ImportItemSection title="Ready To Import" items={plan.ready} emptyText="No missing supported routes were found." />
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
                                {importing ? "Importing..." : `Import Missing (${plan.ready.length})`}
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
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                Skipped
            </Typography>
            {items.length === 0 ? (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                    No skipped routes.
                </Typography>
            ) : (
                <Stack spacing={0.75}>
                    {items.slice(0, 8).map((item) => (
                        <ImportLine
                            key={`${item.reason}:${item.key}`}
                            primary={`${item.record.provider}: ${item.record.source}`}
                            secondary={`${item.message} Channel: ${item.record.channelId}`}
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
    const totalFindings = review.duplicateRoutes.length + review.multiChannelFeeds.length + review.busyChannels.length;

    return (
        <FeaturePanel accent={dashboardAccents.settings} sx={{ mt: 3 }}>
            <Stack spacing={2}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            Setup Review
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)", mt: 0.5 }}>
                            Duplicate routes, cross-channel feed overlap, and high-volume notification channels.
                        </Typography>
                    </Box>
                    <Chip
                        label={totalFindings === 0 ? "No findings" : `${totalFindings} ${totalFindings === 1 ? "finding" : "findings"}`}
                        color={totalFindings === 0 ? "success" : "warning"}
                        variant="outlined"
                    />
                </Box>

                {totalFindings === 0 ? (
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                        No duplicate notification routes or crowded destination channels were detected.
                    </Typography>
                ) : (
                    <Stack spacing={1.5}>
                        <ReviewGroupSection title="Duplicate Routes" groups={review.duplicateRoutes} guildId={guildId} />
                        <ReviewGroupSection title="Same Feed, Multiple Channels" groups={review.multiChannelFeeds} guildId={guildId} />
                        <BusyChannelSection channels={review.busyChannels} guildId={guildId} />
                    </Stack>
                )}
            </Stack>
        </FeaturePanel>
    );
}

function ReviewGroupSection({ title, groups, guildId }: { title: string; groups: NotificationReviewGroup[]; guildId: string }) {
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
                        secondary={`${group.records.length} routes across ${group.channelIds.length} ${group.channelIds.length === 1 ? "channel" : "channels"}: ${group.channelIds.join(", ")}`}
                        actions={toReviewActions(buildNotificationReviewGroupLink(guildId, group))}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function BusyChannelSection({ channels, guildId }: { channels: NotificationChannelLoad[]; guildId: string }) {
    if (channels.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" sx={{ color: "grey.100", fontWeight: 800, mb: 0.75 }}>
                Busy Channels
            </Typography>
            <Stack spacing={0.75}>
                {channels.slice(0, 5).map((channel) => (
                    <ReviewLine
                        key={channel.channelId}
                        primary={channel.channelId}
                        secondary={`${channel.count} feeds from ${channel.providers.join(", ")}`}
                        actions={toReviewActions(buildNotificationChannelLinks(guildId, channel))}
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

async function restoreNotificationRecord(guildId: string, item: NotificationSetupImportItem): Promise<void> {
    const create = buildNotificationSetupImportCreatePayload(guildId, item.record);
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
