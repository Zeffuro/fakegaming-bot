"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Avatar, Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { Add, Cancel, CheckCircle, Delete, FormatQuote, Groups, History, HourglassEmpty, LocalOffer, PersonSearch, Send, Today } from "@mui/icons-material";
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

function formatTimestamp(ts: number): string {
    try {
        const d = new Date(Number(ts));
        if (Number.isNaN(d.getTime())) return String(ts);
        return `${new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
        }).format(d)} UTC`;
    } catch {
        return String(ts);
    }
}

function getDisplayName(user?: QuoteCurationUser): string {
    return getQuoteUserDisplayName(user);
}

function buildAvatarUrl(userId: string, avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png`;
}

type MemberItem = QuoteCurationUser & { id: string; discriminator?: string | null; avatar?: string | null };
type QuoteUserMap = Record<string, QuoteCurationUser | undefined>;

export default function GuildQuotesPage() {
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
    const memberSearchCacheRef = React.useRef<Map<string, { ts: number; items: MemberItem[] }>>(new Map());
    const accent = dashboardAccents.quotes;
    const fieldSx = dashboardFieldSx(accent);

    const inputLooksLikeId = useMemo(() => /^(\d{5,})$/.test(memberInput.trim()), [memberInput]);
    const curationSummary = useMemo(() => buildQuoteCurationSummary(allQuotes), [allQuotes]);
    const recentQuotes = useMemo(() => getRecentQuotes(allQuotes, 3), [allQuotes]);
    const duplicateGroups = useMemo(() => findDuplicateQuoteGroups(allQuotes, 3), [allQuotes]);
    const visibleQuotes = useMemo(() => filterQuotesByModerationStatus(quotes, moderationFilter), [moderationFilter, quotes]);

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
                        eyebrow="Quotes"
                        title="Quotes"
                        description="Search, add, and clean up server quotes with Discord member lookup and readable attribution."
                        accent={accent}
                        secondaryAccent={dashboardAccents.commands}
                        stats={[
                            { label: "quotes stored", value: allQuotes.length },
                            { label: "quoted members", value: curationSummary.uniqueAuthors },
                            { label: "curators", value: curationSummary.uniqueSubmitters },
                            { label: "pending", value: curationSummary.pendingQuotes },
                            { label: "approved", value: curationSummary.approvedQuotes },
                            { label: "shown", value: visibleQuotes.length },
                        ]}
                        actions={(
                            <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving} sx={ghostActionButtonSx(accent)}>
                                Refresh
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
                                <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>Find and add quotes</Typography>
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>Search existing quotes, then add new quotes with a resolved author.</Typography>
                            </Box>

                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} sx={{ alignItems: { xs: "stretch", lg: "center" } }}>
                                <TextField label="Search quotes, people, or IDs" size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
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
                                            setMemberInput(`${getDisplayName(opt)} (${opt.id})`);
                                        }
                                    }}
                                    getOptionLabel={(opt) => typeof opt === "string" ? opt : getDisplayName(opt)}
                                    loading={memberLoading}
                                    noOptionsText={memberInput.trim().length < 3 ? "Type at least 3 characters" : "No members found"}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Author"
                                            placeholder="Type a name, nickname, or paste a Discord user ID"
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
                                                        {getDisplayName(item).slice(0, 1).toUpperCase()}
                                                    </Avatar>
                                                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                                                        <Typography variant="body2" sx={{ color: "grey.100" }}>{getDisplayName(item)}</Typography>
                                                        <Typography variant="caption" sx={{ color: "grey.500" }}>{item.username}{item.discriminator ? `#${item.discriminator}` : ""} | {item.id}</Typography>
                                                    </Box>
                                                </Box>
                                            </li>
                                        );
                                    }}
                                />

                                <TextField label="Quote" placeholder="Add a new quote..." size="small" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} fullWidth sx={fieldSx} />

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
                                    Add Quote
                                </Button>
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1fr 1fr 2fr" }, gap: 2 }}>
                                <TextField
                                    label="Tags"
                                    placeholder="funny raid-night"
                                    size="small"
                                    value={quoteTags}
                                    onChange={(event) => setQuoteTags(event.target.value)}
                                    helperText="Separate tags with spaces or commas"
                                    fullWidth
                                    sx={fieldSx}
                                />
                                <TextField
                                    label="Source"
                                    placeholder="Voice chat, stream, message link"
                                    size="small"
                                    value={quoteSource}
                                    onChange={(event) => setQuoteSource(event.target.value)}
                                    fullWidth
                                    sx={fieldSx}
                                />
                                <TextField
                                    label="Context"
                                    placeholder="Optional note about when or why this was said"
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
                                title={allQuotes.length === 0 ? "No quotes yet" : "No quotes match these filters"}
                                description={allQuotes.length === 0 ? "Add the first quote above to start building this server's quote archive." : "Adjust search or moderation status filters to broaden the quote list."}
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
                                                    by {getDisplayName(author)} | added by {getDisplayName(submitter)} | {formatTimestamp(q.timestamp)}
                                                </Typography>
                                                <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.75 }}>
                                                    <ModerationStatusChip status={moderationStatus} />
                                                </Stack>
                                                <QuoteMetadata quote={q} />
                                            </Box>
                                            <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", ml: { sm: "auto" } }}>
                                                <Tooltip title="Approve quote">
                                                    <span>
                                                        <IconButton
                                                            aria-label={`Approve quote ${q.id}`}
                                                            disabled={saving || moderationStatus === "approved"}
                                                            onClick={() => void setQuoteModerationStatus(q.id, "approved")}
                                                            sx={ghostActionButtonSx(dashboardAccents.settings)}
                                                        >
                                                            <CheckCircle />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Reject quote">
                                                    <span>
                                                        <IconButton
                                                            aria-label={`Reject quote ${q.id}`}
                                                            disabled={saving || moderationStatus === "rejected"}
                                                            onClick={() => void setQuoteModerationStatus(q.id, "rejected")}
                                                            sx={ghostActionButtonSx(dashboardAccents.patchNotes)}
                                                        >
                                                            <Cancel />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Delete quote">
                                                    <span>
                                                        <IconButton color="error" disabled={saving} onClick={() => void deleteQuote(q.id)} sx={dangerActionButtonSx}>
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
    return (
        <FeaturePanel accent={accent} sx={{ mb: 3 }}>
            <Stack spacing={2.25} sx={{ position: "relative" }}>
                <Box>
                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850 }}>Quote curation</Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.5 }}>
                        Review quote coverage, active curators, and the newest archive entries.
                    </Typography>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(5, minmax(0, 1fr))" }, gap: 1.5 }}>
                    <CurationMetric icon={<FormatQuote />} label="Total" value={summary.total} accent={accent} />
                    <CurationMetric icon={<HourglassEmpty />} label="Pending" value={summary.pendingQuotes} accent={dashboardAccents.patchNotes} />
                    <CurationMetric icon={<CheckCircle />} label="Approved" value={summary.approvedQuotes} accent={dashboardAccents.settings} />
                    <CurationMetric icon={<Cancel />} label="Rejected" value={summary.rejectedQuotes} accent={dashboardAccents.quotes} />
                    <CurationMetric icon={<Groups />} label="Quoted" value={summary.uniqueAuthors} accent={dashboardAccents.commands} />
                    <CurationMetric icon={<PersonSearch />} label="Curators" value={summary.uniqueSubmitters} accent={dashboardAccents.settings} />
                    <CurationMetric icon={<LocalOffer />} label="Tagged" value={summary.taggedQuotes} accent={dashboardAccents.anime} />
                    <CurationMetric icon={<FormatQuote />} label="Duplicates" value={duplicateGroups.length} accent={dashboardAccents.quotes} />
                    <CurationMetric icon={<History />} label="Latest" value={summary.latestQuote ? formatTimestamp(summary.latestQuote.timestamp) : "None"} accent={dashboardAccents.neutral} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }, gap: 2 }}>
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>Top quoted members</Typography>
                        {summary.topAuthors.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>No quoted members yet.</Typography>
                        ) : (
                            <Stack spacing={1}>
                                {summary.topAuthors.map((author) => (
                                    <TopQuotedMemberRow key={author.authorId} author={author} userMap={userMap} />
                                ))}
                            </Stack>
                        )}
                    </Box>

                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>Recent additions</Typography>
                        {recentQuotes.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>No recent additions yet.</Typography>
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
                    <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>Top tags</Typography>
                    {summary.topTags.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>No tags have been added yet.</Typography>
                    ) : (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                            {summary.topTags.map((item) => (
                                <Chip
                                    key={item.tag}
                                    label={`${item.tag} x${item.count}`}
                                    size="small"
                                    sx={{ bgcolor: "rgba(255,255,255,0.08)", color: "grey.100", border: "1px solid rgba(255,255,255,0.10)" }}
                                />
                            ))}
                        </Stack>
                    )}
                </Box>

                <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Typography sx={{ color: "grey.50", fontWeight: 850, mb: 1.5 }}>Duplicate review</Typography>
                    {duplicateGroups.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)" }}>No duplicate quote text detected.</Typography>
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
                                Quote of the day
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.56)", mt: 0.35 }}>
                                {preview ? `${preview.eligibleCount} approved quote${preview.eligibleCount === 1 ? "" : "s"} eligible for ${preview.date}.` : "Loading preview..."}
                            </Typography>
                        </Box>
                    </Stack>
                    <Chip
                        size="small"
                        label={enabled ? "Enabled" : "Disabled"}
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
                                    by {getDisplayName(userMap[quote.authorId])} | {formatTimestamp(quote.timestamp)}
                                </Typography>
                                <QuoteMetadata quote={quote} />
                            </Stack>
                        ) : (
                            <EmptyState
                                icon={<FormatQuote />}
                                title={loading ? "Loading quote preview" : "No approved quote available"}
                                description={loading ? "Loading quote-of-the-day preview." : "Approve at least one quote before enabling daily delivery."}
                                accent={accent}
                            />
                        )}
                    </Box>

                    <Stack spacing={1.5}>
                        <FormControl size="small" fullWidth sx={dashboardFieldSx(dashboardAccents.commands)}>
                            <InputLabel id="quote-of-day-channel-label">Channel</InputLabel>
                            <Select
                                labelId="quote-of-day-channel-label"
                                label="Channel"
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
                            <InputLabel id="quote-of-day-hour-label">UTC hour</InputLabel>
                            <Select
                                labelId="quote-of-day-hour-label"
                                label="UTC hour"
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
                                    Daily delivery
                                </Typography>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.52)" }}>
                                    {channelId ? `${getChannelName(channelId)} at ${String(runHourUtc).padStart(2, "0")}:00 UTC` : "Choose a channel"}
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
                            Save Daily Quote
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
    const options: Array<{ value: QuoteModerationFilter; label: string; count: number }> = [
        { value: "all", label: "All", count: summary.total },
        { value: "pending", label: "Pending", count: summary.pendingQuotes },
        { value: "approved", label: "Approved", count: summary.approvedQuotes },
        { value: "rejected", label: "Rejected", count: summary.rejectedQuotes },
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
            aria-label="Quote moderation filter"
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
                <ToggleButton key={option.value} value={option.value} aria-label={`${option.label} quote filter`}>
                    {option.label} {option.count}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

function ModerationStatusChip({ status }: { status: QuoteModerationStatus }) {
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
            label={status}
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
                    Source: {source}
                </Typography>
            ) : null}
            {context ? (
                <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.54)", overflowWrap: "anywhere" }}>
                    Context: {context}
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
    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, overflowWrap: "anywhere" }}>
                    {getDisplayName(userMap[author.authorId])}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)" }}>
                    {author.authorId}
                </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: dashboardAccents.quotes, fontWeight: 900, whiteSpace: "nowrap" }}>
                {author.count} {author.count === 1 ? "quote" : "quotes"}
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
    return (
        <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, overflowWrap: "anywhere" }}>
                {quotePreview(quote.quote)}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                by {getDisplayName(userMap[quote.authorId])} | added by {getDisplayName(userMap[quote.submitterId])} | {formatTimestamp(quote.timestamp)}
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
    return (
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.08)", pt: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 850, overflowWrap: "anywhere" }}>
                        {quotePreview(group.quotes[0]?.quote ?? group.normalizedQuote)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)" }}>
                        {group.count} matching entries | newest {formatTimestamp(group.latestTimestamp)}
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
                                by {getDisplayName(userMap[quote.authorId])} | added by {getDisplayName(userMap[quote.submitterId])} | {formatTimestamp(quote.timestamp)}
                            </Typography>
                        </Box>
                        <Tooltip title="Delete duplicate quote">
                            <span>
                                <IconButton
                                    aria-label={`Delete duplicate quote ${quote.id}`}
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
