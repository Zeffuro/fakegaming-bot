"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Avatar, Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { AccountBox, Add, Cancel, CheckCircle, Delete, Download, FormatQuote, Groups, History, HourglassEmpty, LocalOffer, PersonSearch, Send, Today } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildChannels } from "@/components/hooks/useGuildChannels";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useQuotes } from "@/components/hooks/useQuotes";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { api } from "@/lib/api-client";
import type { QuoteOfDayPreviewResponse, QuoteOfDaySettingsRequest } from "@/lib/api/quotes";
import {
    buildQuoteCurationSummary,
    filterQuotesByModerationStatus,
    findDuplicateQuoteGroups,
    getQuoteUserDisplayName,
    getRecentQuotes,
    normalizeQuoteModerationStatus,
    parseQuoteTagInput,
    type QuoteAuthorCount,
    type QuoteDuplicateGroup,
    type QuoteCurationQuote,
    type QuoteCurationUser,
    type QuoteModerationFilter,
    type QuoteModerationStatus,
} from "@/lib/quoteCuration";

function formatTimestamp(ts: number, formatDate: ReturnType<typeof useDashboardI18n>["formatDate"], t: ReturnType<typeof useDashboardI18n>["t"]): string {
    try {
        const d = new Date(Number(ts));
        if (Number.isNaN(d.getTime())) return String(ts);
        return t("quotes.timestamp", { date: formatDate(d, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
        }) });
    } catch {
        return String(ts);
    }
}

function getDisplayName(user: QuoteCurationUser | undefined, unknownLabel: string): string {
    return getQuoteUserDisplayName(user, unknownLabel);
}

function buildAvatarUrl(userId: string, avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png`;
}

type MemberItem = QuoteCurationUser & { id: string; discriminator?: string | null; avatar?: string | null };
type QuoteUserMap = Record<string, QuoteCurationUser | undefined>;

export default function GuildQuotesPage() {
    const { t, formatDate, formatNumber } = useDashboardI18n();
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const {
        quotes,
        allQuotes,
        userMap,
        loading,
        saving,
        quoteOfDayLoading,
        quoteOfDaySaving,
        quoteOfDayPreview,
        error,
        setError,
        search,
        setSearch,
        refresh,
        addQuote,
        deleteQuote,
        setQuoteModerationStatus,
        updateQuoteOfDaySettings
    } = useQuotes(guildId as string);
    const channelsApi = useGuildChannels(guildId as string, { enabled: Boolean(guildId) });

    const [authorId, setAuthorId] = useState("");
    const [quoteText, setQuoteText] = useState("");
    const [quoteTags, setQuoteTags] = useState("");
    const [quoteSource, setQuoteSource] = useState("");
    const [quoteContext, setQuoteContext] = useState("");
    const [moderationFilter, setModerationFilter] = useState<QuoteModerationFilter>("all");
    const [memberInput, setMemberInput] = useState<string>("");
    const [memberOptions, setMemberOptions] = useState<MemberItem[]>([]);
    const [memberLoading, setMemberLoading] = useState<boolean>(false);
    const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);
    const [downloadingProfileUserId, setDownloadingProfileUserId] = useState<string | null>(null);
    const memberSearchCacheRef = React.useRef<Map<string, { ts: number; items: MemberItem[] }>>(new Map());
    const accent = dashboardAccents.quotes;
    const fieldSx = dashboardFieldSx(accent);

    const inputLooksLikeId = useMemo(() => /^(\d{5,})$/.test(memberInput.trim()), [memberInput]);
    const curationSummary = useMemo(() => buildQuoteCurationSummary(allQuotes), [allQuotes]);
    const recentQuotes = useMemo(() => getRecentQuotes(allQuotes, 3), [allQuotes]);
    const duplicateGroups = useMemo(() => findDuplicateQuoteGroups(allQuotes, 3), [allQuotes]);
    const visibleQuotes = useMemo(() => filterQuotesByModerationStatus(quotes, moderationFilter), [moderationFilter, quotes]);

    const downloadQuoteCard = async (quote: QuoteCurationQuote): Promise<void> => {
        try {
            setDownloadingQuoteId(quote.id);
            const blob = await api.getQuoteCardImage(quote.id);
            downloadBlob(blob, buildQuoteCardDownloadFilename(quote.id));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("quotes.error.downloadCard"));
        } finally {
            setDownloadingQuoteId(null);
        }
    };

    const downloadProfileCard = async (userId: string): Promise<void> => {
        if (!guildId) return;
        try {
            setDownloadingProfileUserId(userId);
            const blob = await api.getProfileCardImage(String(guildId), userId);
            downloadBlob(blob, buildProfileCardDownloadFilename(userId));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("quotes.error.downloadProfileCard"));
        } finally {
            setDownloadingProfileUserId(null);
        }
    };

    useEffect(() => {
        if (inputLooksLikeId) {
            setAuthorId(memberInput.trim());
        } else if (!memberInput) {
            setAuthorId("");
        }
    }, [inputLooksLikeId, memberInput]);

    useEffect(() => {
        let active = true;
        const q = memberInput.trim();
        if (!guildId || q.length < 3 || inputLooksLikeId) {
            setMemberOptions([]);
            return;
        }
        setMemberLoading(true);

        const cacheKey = `${String(guildId)}::${q.toLowerCase()}`;
        const cached = memberSearchCacheRef.current.get(cacheKey);
        const now = Date.now();
        const TTL_MS = 2 * 60 * 1000;
        if (cached && now - cached.ts < TTL_MS) {
            setMemberOptions(cached.items);
            setMemberLoading(false);
            return;
        }

        const handle = setTimeout(async () => {
            try {
                const res = await api.searchGuildMembers(String(guildId), q, 25);
                if (!active) return;
                const items = Array.isArray(res) ? (res as MemberItem[]) : [];
                setMemberOptions(items);
                memberSearchCacheRef.current.set(cacheKey, { ts: now, items });
            } catch {
                if (active) setMemberOptions([]);
            } finally {
                if (active) setMemberLoading(false);
            }
        }, 250);
        return () => {
            active = false;
            clearTimeout(handle);
        };
    }, [guildId, memberInput, inputLooksLikeId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    return (
        <DashboardLayout guild={guild} currentModule="quotes" maxWidth="xl" loading={loading || guildsLoading}>
            {!loading && guild && (
                <FeatureShell accent={accent} secondaryAccent={dashboardAccents.commands}>
                    <FeatureHero
                        icon={<FormatQuote />}
                        eyebrow={t("quotes.title")}
                        title={t("quotes.title")}
                        description={t("quotes.description")}
                        accent={accent}
                        secondaryAccent={dashboardAccents.commands}
                        stats={[
                            { label: t("quotes.stats.stored"), value: formatNumber(allQuotes.length) },
                            { label: t("quotes.stats.quotedMembers"), value: formatNumber(curationSummary.uniqueAuthors) },
                            { label: t("quotes.stats.curators"), value: formatNumber(curationSummary.uniqueSubmitters) },
                            { label: t("quotes.stats.pending"), value: formatNumber(curationSummary.pendingQuotes) },
                            { label: t("quotes.stats.approved"), value: formatNumber(curationSummary.approvedQuotes) },
                            { label: t("quotes.stats.shown"), value: formatNumber(visibleQuotes.length) },
                        ]}
                        actions={(
                            <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving} sx={ghostActionButtonSx(accent)}>
                                {t("common.refresh")}
                            </Button>
                        )}
                    />

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <FeaturePanel accent={accent} sx={{ mb: 3 }}>
                        <Stack spacing={2.25} sx={{ position: "relative" }}>
                            <Box>
                                <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>{t("quotes.findAdd.title")}</Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>{t("quotes.findAdd.description")}</Typography>
                            </Box>

                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", lg: "center" } }}>
                                <TextField label={t("quotes.search")} size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
                                <QuoteModerationFilterControl
                                    value={moderationFilter}
                                    onChange={setModerationFilter}
                                    summary={curationSummary}
                                    accent={accent}
                                />
                            </Stack>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 3fr auto" }, gap: 2, alignItems: "start", width: "100%" }}>
                                <Autocomplete<MemberItem, false, false, true>
                                    freeSolo
                                    fullWidth
                                    options={memberOptions}
                                    inputValue={memberInput}
                                    onInputChange={(_e, value) => setMemberInput(value)}
                                    onChange={(_e, newValue) => {
                                        const opt = (newValue as MemberItem | string | null);
                                        if (opt && typeof opt !== "string" && opt.id) {
                                            setAuthorId(opt.id);
                                            setMemberInput(`${getDisplayName(opt, t("quotes.unknown"))} (${opt.id})`);
                                        }
                                    }}
                                    getOptionLabel={(opt) => typeof opt === "string" ? opt : getDisplayName(opt, t("quotes.unknown"))}
                                    loading={memberLoading}
                                    noOptionsText={memberInput.trim().length < 3 ? t("quotes.typeThree") : t("quotes.noMembers")}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("quotes.author")}
                                            placeholder={t("quotes.authorPlaceholder")}
                                            size="small"
                                            fullWidth
                                            sx={fieldSx}
                                            slotProps={{
                                                ...params.slotProps,
                                                input: {
                                                    ...params.slotProps.input,
                                                    endAdornment: (
                                                        <>
                                                            {memberLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                                                            {params.slotProps.input.endAdornment}
                                                        </>
                                                    )
                                                }
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => {
                                        const item = option as MemberItem;
                                        const avatarUrl = buildAvatarUrl(item.id, item.avatar ?? null);
                                        const { key: liKey, ...liProps } = (props as unknown as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>);
                                        return (
                                            <li key={liKey} {...liProps}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                                    <Avatar src={avatarUrl ?? undefined} sx={{ width: 24, height: 24 }}>
                                                        {getDisplayName(item, t("quotes.unknown")).slice(0, 1).toUpperCase()}
                                                    </Avatar>
                                                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                                                        <Typography variant="body2" sx={{ color: "grey.100" }}>{getDisplayName(item, t("quotes.unknown"))}</Typography>
                                                        <Typography variant="caption" sx={{ color: "grey.500" }}>{item.username}{item.discriminator ? `#${item.discriminator}` : ""} | {item.id}</Typography>
                                                    </Box>
                                                </Box>
                                            </li>
                                        );
                                    }}
                                />

                                <TextField label={t("quotes.quote")} placeholder={t("quotes.quotePlaceholder")} size="small" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} fullWidth sx={fieldSx} />

                                <Button
                                    variant="contained"
                                    startIcon={<Add />}
                                    disabled={saving || !authorId || !quoteText}
                                    onClick={async () => {
                                        const ok = await addQuote({
                                            authorId,
                                            quote: quoteText,
                                            timestamp: Date.now(),
                                            tags: parseQuoteTagInput(quoteTags),
                                            source: quoteSource.trim() || null,
                                            context: quoteContext.trim() || null,
                                        });
                                        if (ok) {
                                            setAuthorId("");
                                            setMemberInput("");
                                            setMemberOptions([]);
                                            setQuoteText("");
                                            setQuoteTags("");
                                            setQuoteSource("");
                                            setQuoteContext("");
                                        }
                                    }}
                                    sx={{ ...primaryActionButtonSx(accent), whiteSpace: "nowrap", justifySelf: { xs: "stretch", lg: "end" } }}
                                >
                                    {t("quotes.add")}
                                </Button>
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 2fr" }, gap: 2 }}>
                                <TextField
                                    label={t("quotes.tags")}
                                    placeholder={t("quotes.tagsPlaceholder")}
                                    size="small"
                                    value={quoteTags}
                                    onChange={(event) => setQuoteTags(event.target.value)}
                                    helperText={t("quotes.tagsHelp")}
                                    fullWidth
                                    sx={fieldSx}
                                />
                                <TextField
                                    label={t("quotes.source")}
                                    placeholder={t("quotes.sourcePlaceholder")}
                                    size="small"
                                    value={quoteSource}
                                    onChange={(event) => setQuoteSource(event.target.value)}
                                    fullWidth
                                    sx={fieldSx}
                                />
                                <TextField
                                    label={t("quotes.context")}
                                    placeholder={t("quotes.contextPlaceholder")}
                                    size="small"
                                    value={quoteContext}
                                    onChange={(event) => setQuoteContext(event.target.value)}
                                    fullWidth
                                    sx={fieldSx}
                                />
                            </Box>
                        </Stack>
                    </FeaturePanel>

                    <QuoteCurationPanel
                        summary={curationSummary}
                        recentQuotes={recentQuotes}
                        duplicateGroups={duplicateGroups}
                        userMap={userMap}
                        accent={accent}
                        saving={saving}
                        onDelete={deleteQuote}
                    />

                    <QuoteOfDayPanel
                        preview={quoteOfDayPreview}
                        channels={channelsApi.channels}
                        getChannelName={channelsApi.getChannelName}
                        userMap={userMap}
                        loading={quoteOfDayLoading || channelsApi.loading}
                        saving={quoteOfDaySaving}
                        accent={accent}
                        onSave={updateQuoteOfDaySettings}
                    />

                    <FeaturePanel accent={accent}>
                        {visibleQuotes.length === 0 ? (
                            <EmptyState
                                icon={<FormatQuote />}
                                title={allQuotes.length === 0 ? t("quotes.empty.none") : t("quotes.empty.filtered")}
                                description={allQuotes.length === 0 ? t("quotes.empty.noneDescription") : t("quotes.empty.filteredDescription")}
                                accent={accent}
                            />
                        ) : (
                            <Stack spacing={1.5} sx={{ position: "relative" }}>
                                {visibleQuotes.map(q => {
                                    const author = userMap[q.authorId];
                                    const submitter = userMap[q.submitterId];
                                    const moderationStatus = normalizeQuoteModerationStatus(q.moderationStatus);
                                    return (
                                        <Box key={q.id} sx={{ ...dashboardCardSx(accent), display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 2, p: 2 }}>
                                            <FormatQuote sx={{ color: accent, mt: 0.5 }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 650 }}>
                                                    {q.quote}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                                                    {t("quotes.attribution", { author: getDisplayName(author, t("quotes.unknown")), submitter: getDisplayName(submitter, t("quotes.unknown")), date: formatTimestamp(q.timestamp, formatDate, t) })}
                                                </Typography>
                                                <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                                                    <ModerationStatusChip status={moderationStatus} />
                                                </Stack>
                                                <QuoteMetadata quote={q} />
                                            </Box>
                                            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", ml: { sm: "auto" } }}>
                                                <Tooltip title={t("quotes.action.approve")}>
                                                    <span>
                                                        <IconButton
                                                            aria-label={t("quotes.action.approveAria", { id: q.id })}
                                                            disabled={saving || moderationStatus === "approved"}
                                                            onClick={() => void setQuoteModerationStatus(q.id, "approved")}
                                                            sx={ghostActionButtonSx(dashboardAccents.settings)}
                                                        >
                                                            <CheckCircle />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title={t("quotes.action.reject")}>
                                                    <span>
                                                        <IconButton
                                                            aria-label={t("quotes.action.rejectAria", { id: q.id })}
                                                            disabled={saving || moderationStatus === "rejected"}
                                                            onClick={() => void setQuoteModerationStatus(q.id, "rejected")}
                                                            sx={ghostActionButtonSx(dashboardAccents.patchNotes)}
                                                        >
                                                            <Cancel />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title={moderationStatus === "approved" ? t("quotes.action.downloadCard") : t("quotes.action.approveBeforeDownload")}>
                                                    <span>
                                                        <IconButton
                                                            aria-label={t("quotes.action.downloadCardAria", { id: q.id })}
                                                            disabled={saving || downloadingQuoteId === q.id || moderationStatus !== "approved"}
                                                            onClick={() => void downloadQuoteCard(q)}
                                                            sx={ghostActionButtonSx(accent)}
                                                        >
                                                            {downloadingQuoteId === q.id ? <CircularProgress size={20} /> : <Download />}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title={t("quotes.action.downloadProfile")}>
                                                    <span>
                                                        <IconButton
                                                            aria-label={t("quotes.action.downloadProfileAria", { id: q.authorId })}
                                                            disabled={saving || downloadingProfileUserId === q.authorId}
                                                            onClick={() => void downloadProfileCard(q.authorId)}
                                                            sx={ghostActionButtonSx(dashboardAccents.commands)}
                                                        >
                                                            {downloadingProfileUserId === q.authorId ? <CircularProgress size={20} /> : <AccountBox />}
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title={t("quotes.action.delete")}>
                                                    <span>
                                                        <IconButton aria-label={t("quotes.action.delete")} color="error" disabled={saving} onClick={() => void deleteQuote(q.id)} sx={dangerActionButtonSx}>
                                                            <Delete />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </FeaturePanel>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function QuoteCurationPanel({
    summary,
    recentQuotes,
    duplicateGroups,
    userMap,
    accent,
    saving,
    onDelete,
}: {
    summary: ReturnType<typeof buildQuoteCurationSummary>;
    recentQuotes: QuoteCurationQuote[];
    duplicateGroups: QuoteDuplicateGroup<QuoteCurationQuote>[];
    userMap: QuoteUserMap;
    accent: string;
    saving: boolean;
    onDelete: (id: string) => void | Promise<unknown>;
}) {
    const { t, formatDate, formatNumber } = useDashboardI18n();
    return (
        <FeaturePanel accent={accent} sx={{ mb: 3 }}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Box>
                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>{t("quotes.curation.title")}</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                        {t("quotes.curation.description")}
                    </Typography>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, gap: 1.5 }}>
                    <CurationMetric icon={<FormatQuote />} label={t("quotes.curation.total")} value={formatNumber(summary.total)} accent={accent} />
                    <CurationMetric icon={<HourglassEmpty />} label={t("quotes.status.pending")} value={formatNumber(summary.pendingQuotes)} accent={dashboardAccents.patchNotes} />
                    <CurationMetric icon={<CheckCircle />} label={t("quotes.status.approved")} value={formatNumber(summary.approvedQuotes)} accent={dashboardAccents.settings} />
                    <CurationMetric icon={<Cancel />} label={t("quotes.status.rejected")} value={formatNumber(summary.rejectedQuotes)} accent={dashboardAccents.quotes} />
                    <CurationMetric icon={<Groups />} label={t("quotes.curation.quoted")} value={formatNumber(summary.uniqueAuthors)} accent={dashboardAccents.commands} />
                    <CurationMetric icon={<PersonSearch />} label={t("quotes.stats.curators")} value={formatNumber(summary.uniqueSubmitters)} accent={dashboardAccents.settings} />
                    <CurationMetric icon={<LocalOffer />} label={t("quotes.curation.tagged")} value={formatNumber(summary.taggedQuotes)} accent={dashboardAccents.anime} />
                    <CurationMetric icon={<FormatQuote />} label={t("quotes.curation.duplicates")} value={formatNumber(duplicateGroups.length)} accent={dashboardAccents.quotes} />
                    <CurationMetric icon={<History />} label={t("quotes.curation.latest")} value={summary.latestQuote ? formatTimestamp(summary.latestQuote.timestamp, formatDate, t) : t("quotes.none")} accent={dashboardAccents.neutral} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }, gap: 2 }}>
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>{t("quotes.curation.topMembers")}</Typography>
                        {summary.topAuthors.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>{t("quotes.curation.noMembers")}</Typography>
                        ) : (
                            <Stack spacing={1}>
                                {summary.topAuthors.map((author) => (
                                    <TopQuotedMemberRow key={author.authorId} author={author} userMap={userMap} />
                                ))}
                            </Stack>
                        )}
                    </Box>

                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>{t("quotes.curation.recent")}</Typography>
                        {recentQuotes.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>{t("quotes.curation.noRecent")}</Typography>
                        ) : (
                            <Stack spacing={1.2}>
                                {recentQuotes.map((quote) => (
                                    <RecentQuoteRow key={quote.id} quote={quote} userMap={userMap} />
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Box>

                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>{t("quotes.curation.topTags")}</Typography>
                    {summary.topTags.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>{t("quotes.curation.noTags")}</Typography>
                    ) : (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                            {summary.topTags.map((item) => (
                                <Chip
                                    key={item.tag}
                                    label={t("quotes.curation.tagCount", { tag: item.tag, count: formatNumber(item.count) })}
                                    size="small"
                                    sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "grey.100", border: "1px solid rgba(255,255,255,0.10)" }}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>

                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>{t("quotes.curation.duplicateReview")}</Typography>
                    {duplicateGroups.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>{t("quotes.curation.noDuplicates")}</Typography>
                    ) : (
                        <Stack spacing={1.5}>
                            {duplicateGroups.map((group) => (
                                <DuplicateQuoteGroup
                                    key={group.normalizedQuote}
                                    group={group}
                                    userMap={userMap}
                                    saving={saving}
                                    onDelete={onDelete}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function QuoteOfDayPanel({
    preview,
    channels,
    getChannelName,
    userMap,
    loading,
    saving,
    accent,
    onSave,
}: {
    preview: QuoteOfDayPreviewResponse | null;
    channels: Array<{ id: string; name: string; type: number }>;
    getChannelName: (channelId: string) => string;
    userMap: QuoteUserMap;
    loading: boolean;
    saving: boolean;
    accent: string;
    onSave: (settings: QuoteOfDaySettingsRequest) => Promise<boolean>;
}) {
    const { t, formatDate, formatNumber } = useDashboardI18n();
    const settings = preview?.settings ?? null;
    const quote = preview?.quote as QuoteCurationQuote | null | undefined;
    const [enabled, setEnabled] = useState(false);
    const [channelId, setChannelId] = useState("");
    const [runHourUtc, setRunHourUtc] = useState(9);

    useEffect(() => {
        setEnabled(Boolean(settings?.enabled));
        setChannelId(settings?.channelId ?? "");
        setRunHourUtc(settings?.runHourUtc ?? 9);
    }, [settings?.channelId, settings?.enabled, settings?.runHourUtc]);

    const channelOptions = useMemo(() => {
        const exists = channelId && channels.some((channel) => channel.id === channelId);
        return exists || !channelId
            ? channels
            : [{ id: channelId, name: getChannelName(channelId).replace(/^#/, ""), type: 0 }, ...channels];
    }, [channelId, channels, getChannelName]);
    const canSave = channelId.trim().length > 0;

    return (
        <FeaturePanel accent={dashboardAccents.commands} sx={{ mb: 3 }}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1.1} sx={{ alignItems: "center", minWidth: 0 }}>
                        <Today sx={{ color: dashboardAccents.commands }} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>
                                {t("quotes.day.title")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.35 }}>
                                {preview ? t("quotes.day.eligible", { count: formatNumber(preview.eligibleCount), date: preview.date }) : t("quotes.day.loadingPreview")}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        size="small"
                        label={enabled ? t("common.enabled") : t("common.disabled")}
                        sx={{
                            alignSelf: { xs: "flex-start", md: "center" },
                            bgcolor: alpha(enabled ? dashboardAccents.settings : dashboardAccents.neutral, 0.14),
                            color: "grey.100",
                            border: `1px solid ${alpha(enabled ? dashboardAccents.settings : dashboardAccents.neutral, 0.28)}`,
                        }}
                    />
                </Stack>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.2fr) minmax(320px, 0.8fr)" }, gap: 2 }}>
                    <Box sx={{ borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: `1px solid ${alpha(accent, 0.18)}`, p: 2, minWidth: 0 }}>
                        {quote ? (
                            <Stack spacing={1}>
                                <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 750, overflowWrap: "anywhere" }}>
                                    {quote.quote}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                    {t("quotes.by", { author: getDisplayName(userMap[quote.authorId], t("quotes.unknown")) })} | {formatTimestamp(quote.timestamp, formatDate, t)}
                                </Typography>
                                <QuoteMetadata quote={quote} />
                            </Stack>
                        ) : (
                            <EmptyState
                                icon={<FormatQuote />}
                                title={loading ? t("quotes.day.loadingTitle") : t("quotes.day.emptyTitle")}
                                description={loading ? t("quotes.day.loadingDescription") : t("quotes.day.emptyDescription")}
                                accent={accent}
                            />
                        )}
                    </Box>

                    <Stack spacing={1.5}>
                        <FormControl size="small" fullWidth sx={dashboardFieldSx(dashboardAccents.commands)}>
                            <InputLabel id="quote-of-day-channel-label">{t("quotes.day.channel")}</InputLabel>
                            <Select
                                labelId="quote-of-day-channel-label"
                                label={t("quotes.day.channel")}
                                value={channelId}
                                onChange={(event) => setChannelId(event.target.value)}
                            >
                                {channelOptions.map((channel) => (
                                    <MenuItem key={channel.id} value={channel.id}>
                                        #{channel.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" fullWidth sx={dashboardFieldSx(dashboardAccents.commands)}>
                            <InputLabel id="quote-of-day-hour-label">{t("quotes.day.utcHour")}</InputLabel>
                            <Select
                                labelId="quote-of-day-hour-label"
                                label={t("quotes.day.utcHour")}
                                value={String(runHourUtc)}
                                onChange={(event) => setRunHourUtc(Number(event.target.value))}
                            >
                                {Array.from({ length: 24 }, (_item, hour) => (
                                    <MenuItem key={hour} value={String(hour)}>
                                        {String(hour).padStart(2, "0")}:00 UTC
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", px: 1.5, py: 1 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800 }}>
                                    {t("quotes.day.dailyDelivery")}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                    {channelId ? t("quotes.day.deliverySummary", { channel: getChannelName(channelId), hour: String(runHourUtc).padStart(2, "0") }) : t("quotes.day.chooseChannel")}
                                </Typography>
                            </Box>
                            <Switch
                                checked={enabled}
                                onChange={(_event, checked) => setEnabled(checked)}
                                sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: dashboardAccents.settings } }}
                            />
                        </Box>

                        <Button
                            disabled={saving || loading || !canSave}
                            onClick={() => void onSave({ channelId, enabled, runHourUtc })}
                            startIcon={<Send />}
                            variant="contained"
                            sx={primaryActionButtonSx(dashboardAccents.commands)}
                        >
                            {t("quotes.day.save")}
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        </FeaturePanel>
    );
}

function QuoteModerationFilterControl({
    value,
    onChange,
    summary,
    accent,
}: {
    value: QuoteModerationFilter;
    onChange: (value: QuoteModerationFilter) => void;
    summary: ReturnType<typeof buildQuoteCurationSummary>;
    accent: string;
}) {
    const { t, formatNumber } = useDashboardI18n();
    const options: Array<{ value: QuoteModerationFilter; label: string; count: number }> = [
        { value: "all", label: t("quotes.status.all"), count: summary.total },
        { value: "pending", label: t("quotes.status.pending"), count: summary.pendingQuotes },
        { value: "approved", label: t("quotes.status.approved"), count: summary.approvedQuotes },
        { value: "rejected", label: t("quotes.status.rejected"), count: summary.rejectedQuotes },
    ];

    const handleChange = (_event: React.MouseEvent<HTMLElement>, nextValue: unknown): void => {
        if (nextValue !== "all" && nextValue !== "pending" && nextValue !== "approved" && nextValue !== "rejected") return;
        onChange(nextValue);
    };

    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            value={value}
            onChange={handleChange}
            aria-label={t("quotes.filterAria")}
            sx={{
                alignSelf: { xs: "flex-start", lg: "center" },
                bgcolor: "rgba(255,255,255,0.045)",
                borderRadius: 999,
                maxWidth: "100%",
                overflowX: "auto",
                p: 0.35,
                "& .MuiToggleButton-root": {
                    border: 0,
                    borderRadius: 999,
                    color: "rgba(255,255,255,0.68)",
                    fontWeight: 850,
                    textTransform: "none",
                    px: 1.2,
                    whiteSpace: "nowrap",
                    "&.Mui-selected": {
                        bgcolor: alpha(accent, 0.22),
                        color: "grey.50",
                    },
                    "&.Mui-selected:hover": {
                        bgcolor: alpha(accent, 0.28),
                    },
                },
            }}
        >
            {options.map((option) => (
                <ToggleButton key={option.value} value={option.value} aria-label={t("quotes.filterOptionAria", { status: option.label })}>
                    {option.label} {formatNumber(option.count)}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

function ModerationStatusChip({ status }: { status: QuoteModerationStatus }) {
    const { t } = useDashboardI18n();
    const accent = getModerationStatusAccent(status);
    const icon = status === "approved"
        ? <CheckCircle fontSize="small" />
        : status === "rejected"
            ? <Cancel fontSize="small" />
            : <HourglassEmpty fontSize="small" />;

    return (
        <Chip
            size="small"
            icon={icon}
            label={status === "approved" ? t("quotes.status.approved") : status === "rejected" ? t("quotes.status.rejected") : t("quotes.status.pending")}
            sx={{
                bgcolor: alpha(accent, 0.12),
                color: "grey.100",
                border: `1px solid ${alpha(accent, 0.24)}`,
                "& .MuiChip-icon": { color: accent },
            }}
        />
    );
}

function getModerationStatusAccent(status: QuoteModerationStatus): string {
    if (status === "approved") return dashboardAccents.settings;
    if (status === "rejected") return dashboardAccents.quotes;
    return dashboardAccents.patchNotes;
}

function CurationMetric({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
    return (
        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)", minWidth: 0 }}>
            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
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

function QuoteMetadata({ quote }: { quote: QuoteCurationQuote }) {
    const { t } = useDashboardI18n();
    const hasTags = quote.tags && quote.tags.length > 0;
    const source = quote.source?.trim();
    const context = quote.context?.trim();
    if (!hasTags && !source && !context) return null;

    return (
        <Stack spacing={0.8} sx={{ mt: 1.2 }}>
            {hasTags ? (
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                    {quote.tags?.map((tag) => (
                        <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            icon={<LocalOffer fontSize="small" />}
                            sx={{
                                bgcolor: "rgba(255,255,255,0.07)",
                                color: "grey.100",
                                border: "1px solid rgba(255,255,255,0.10)",
                                "& .MuiChip-icon": { color: dashboardAccents.anime },
                            }}
                        />
                    ))}
                </Stack>
            ) : null}
            {source ? (
                <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.54)", overflowWrap: "anywhere" }}>
                    {t("quotes.sourceValue", { source })}
                </Typography>
            ) : null}
            {context ? (
                <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.54)", overflowWrap: "anywhere" }}>
                    {t("quotes.contextValue", { context })}
                </Typography>
            ) : null}
        </Stack>
    );
}

function TopQuotedMemberRow({
    author,
    userMap,
}: {
    author: QuoteAuthorCount;
    userMap: QuoteUserMap;
}) {
    const { t, formatNumber } = useDashboardI18n();
    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, overflowWrap: "anywhere" }}>
                    {getDisplayName(userMap[author.authorId], t("quotes.unknown"))}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)" }}>
                    {author.authorId}
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: dashboardAccents.quotes, fontWeight: 900, whiteSpace: "nowrap" }}>
                {t("quotes.curation.quoteCount", { count: formatNumber(author.count) })}
            </Typography>
        </Box>
    );
}

function RecentQuoteRow({
    quote,
    userMap,
}: {
    quote: QuoteCurationQuote;
    userMap: QuoteUserMap;
}) {
    const { t, formatDate } = useDashboardI18n();
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, overflowWrap: "anywhere" }}>
                {quotePreview(quote.quote)}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                {t("quotes.attribution", { author: getDisplayName(userMap[quote.authorId], t("quotes.unknown")), submitter: getDisplayName(userMap[quote.submitterId], t("quotes.unknown")), date: formatTimestamp(quote.timestamp, formatDate, t) })}
            </Typography>
        </Box>
    );
}

function DuplicateQuoteGroup({
    group,
    userMap,
    saving,
    onDelete,
}: {
    group: QuoteDuplicateGroup<QuoteCurationQuote>;
    userMap: QuoteUserMap;
    saving: boolean;
    onDelete: (id: string) => void | Promise<unknown>;
}) {
    const { t, formatDate, formatNumber } = useDashboardI18n();
    return (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.08)", pt: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflowWrap: "anywhere" }}>
                        {quotePreview(group.quotes[0]?.quote ?? group.normalizedQuote)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                        {t("quotes.curation.duplicateSummary", { count: formatNumber(group.count), date: formatTimestamp(group.latestTimestamp, formatDate, t) })}
                    </Typography>
                </Box>
            </Stack>
            <Stack spacing={0.75}>
                {group.quotes.map((quote) => (
                    <Box key={quote.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", justifyContent: "space-between", p: 1, borderRadius: 2, bgcolor: "rgba(0,0,0,0.16)" }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)", display: "block", overflowWrap: "anywhere" }}>
                                {quote.id}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", display: "block" }}>
                                {t("quotes.attribution", { author: getDisplayName(userMap[quote.authorId], t("quotes.unknown")), submitter: getDisplayName(userMap[quote.submitterId], t("quotes.unknown")), date: formatTimestamp(quote.timestamp, formatDate, t) })}
                            </Typography>
                        </Box>
                        <Tooltip title={t("quotes.action.deleteDuplicate")}>
                            <span>
                                <IconButton
                                    aria-label={t("quotes.action.deleteDuplicateAria", { id: quote.id })}
                                    color="error"
                                    disabled={saving}
                                    size="small"
                                    onClick={() => void onDelete(quote.id)}
                                    sx={dangerActionButtonSx}
                                >
                                    <Delete fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}

function quotePreview(value: string): string {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 110 ? `${normalized.slice(0, 107)}...` : normalized;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function buildQuoteCardDownloadFilename(quoteId: string): string {
    const safeId = quoteId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return `quote-card-${safeId || "quote"}.png`;
}

function buildProfileCardDownloadFilename(userId: string): string {
    const safeId = userId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return `profile-card-${safeId || "user"}.png`;
}
