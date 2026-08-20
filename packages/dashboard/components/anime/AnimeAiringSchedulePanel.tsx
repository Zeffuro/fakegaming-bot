"use client";

import React, { useMemo } from "react";
import { CalendarMonth, NotificationsActive, PauseCircleOutlined, Schedule, WarningAmber } from "@mui/icons-material";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import {
    ANIME_ACCENT,
    ANIME_ACCENT_SOFT,
    ANIME_GOLD,
    ANIME_PINK,
    elevatedPanelSx,
} from "@/components/anime/animeTheme";
import { formatAiring, subscriptionTitle } from "@/components/anime/animeUtils";
import { buildAnimeAiringSchedule, type AnimeScheduleItem, type AnimeScheduleStatus } from "@/lib/animeSchedule";
import type { AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface AnimeAiringSchedulePanelProps {
    serverSubs: AnimeSubscriptionDashboardConfig[];
    personalSubs: AnimeSubscriptionDashboardConfig[];
    getChannelName: (channelId: string) => string;
}

function statusLabel(status: AnimeScheduleStatus, t: ReturnType<typeof useDashboardI18n>["t"]): string {
    if (status === "due-now") return t("anime.reminderDue");
    if (status === "aired") return t("anime.aired");
    if (status === "paused") return t("common.paused");
    return t("anime.upcoming");
}

function statusColor(status: AnimeScheduleStatus): string {
    if (status === "due-now") return ANIME_PINK;
    if (status === "aired") return "rgba(255,255,255,0.48)";
    if (status === "paused") return ANIME_GOLD;
    return ANIME_ACCENT_SOFT;
}

function episodeLabel(item: AnimeScheduleItem, t: ReturnType<typeof useDashboardI18n>["t"]): string {
    return item.subscription.nextEpisode ? t("anime.episodeNumber", { number: item.subscription.nextEpisode }) : t("anime.nextEpisode");
}

function destinationLabel(item: AnimeScheduleItem, getChannelName: (channelId: string) => string, t: ReturnType<typeof useDashboardI18n>["t"]): string {
    if (item.scope === "personal") return t("anime.dmReminder");
    const channelId = item.subscription.channelId ?? item.subscription.discordChannelId;
    return channelId ? t("anime.channel", { channel: getChannelName(channelId) }) : t("anime.channelUnresolved");
}

function ScheduleMetric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
    return (
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 0 }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: "grey.50", fontWeight: 900, overflowWrap: "anywhere" }}>{value}</Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>{label}</Typography>
                </Box>
            </Stack>
        </Box>
    );
}

function ScheduleRow({ item, getChannelName }: { item: AnimeScheduleItem; getChannelName: (channelId: string) => string }) {
    const { locale, t } = useDashboardI18n();
    const accent = statusColor(item.status);

    return (
        <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(8,13,22,0.62)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 850, overflowWrap: "anywhere" }}>
                        {subscriptionTitle(item.subscription)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.54)", display: "block" }}>
                        {t("anime.airsAt", { episode: episodeLabel(item, t), date: formatAiring(item.airingAt, locale) })}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)", display: "block" }}>
                        {t("anime.reminderAt", { date: formatAiring(item.reminderAt, locale), destination: destinationLabel(item, getChannelName, t) })}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                    <Chip size="small" label={item.scope === "server" ? t("anime.server") : "DM"} variant="outlined" sx={{ color: "rgba(255,255,255,0.68)", borderColor: "rgba(255,255,255,0.14)" }} />
                    <Chip size="small" label={statusLabel(item.status, t)} sx={{ bgcolor: `${accent}22`, color: accent, border: `1px solid ${accent}55` }} />
                </Stack>
            </Stack>
        </Box>
    );
}

export function AnimeAiringSchedulePanel({ serverSubs, personalSubs, getChannelName }: AnimeAiringSchedulePanelProps) {
    const { formatNumber, t } = useDashboardI18n();
    const schedule = useMemo(() => buildAnimeAiringSchedule(serverSubs, personalSubs), [serverSubs, personalSubs]);
    const nextItem = schedule.summary.nextItem;

    return (
        <Paper sx={{ ...elevatedPanelSx, p: 3 }}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", lg: "center" } }}>
                    <Box>
                        <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, display: "flex", gap: 1, alignItems: "center" }}>
                            <CalendarMonth fontSize="small" />
                            {t("anime.reminderCalendar")}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                            {t("anime.reminderCalendarDescription")}
                        </Typography>
                    </Box>
                    <Chip
                        icon={<Schedule />}
                        label={nextItem ? t("anime.nextTitle", { title: subscriptionTitle(nextItem.subscription) }) : t("anime.noUpcoming")}
                        sx={{ bgcolor: "rgba(104,215,255,0.14)", color: ANIME_ACCENT_SOFT, border: `1px solid ${ANIME_ACCENT}44`, maxWidth: { xs: "100%", lg: 360 } }}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
                    <ScheduleMetric icon={<NotificationsActive />} label={t("anime.due24")} value={schedule.summary.dueWithin24Hours} accent={ANIME_ACCENT_SOFT} />
                    <ScheduleMetric icon={<WarningAmber />} label={t("anime.dueNow")} value={schedule.summary.dueNow} accent={ANIME_PINK} />
                    <ScheduleMetric icon={<CalendarMonth />} label={t("anime.airingKnown")} value={schedule.summary.scheduledSubscriptions} accent={ANIME_ACCENT} />
                    <ScheduleMetric icon={<PauseCircleOutlined />} label={t("common.paused")} value={schedule.summary.pausedSubscriptions} accent={ANIME_GOLD} />
                </Box>

                {schedule.summary.unscheduledSubscriptions > 0 && (
                    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,200,87,0.08)", border: "1px solid rgba(255,200,87,0.18)" }}>
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.68)" }}>
                            {schedule.summary.unscheduledSubscriptions === 1
                                ? t("anime.unscheduledOne")
                                : t("anime.unscheduledMany", { count: formatNumber(schedule.summary.unscheduledSubscriptions) })}
                        </Typography>
                    </Box>
                )}

                {schedule.items.length === 0 ? (
                    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.58)" }}>
                        {t("anime.noAiringData")}
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
                        {schedule.items.map((item) => (
                            <ScheduleRow key={item.key} item={item} getChannelName={getChannelName} />
                        ))}
                    </Box>
                )}
            </Stack>
        </Paper>
    );
}
