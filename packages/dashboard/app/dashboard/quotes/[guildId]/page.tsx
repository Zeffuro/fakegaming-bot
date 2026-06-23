"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Add, Delete, FormatQuote, Groups, History, PersonSearch } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useQuotes } from "@/components/hooks/useQuotes";
import { api } from "@/lib/api-client";
import {
    buildQuoteCurationSummary,
    findDuplicateQuoteGroups,
    getQuoteUserDisplayName,
    getRecentQuotes,
    type QuoteAuthorCount,
    type QuoteDuplicateGroup,
    type QuoteCurationQuote,
    type QuoteCurationUser,
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
        error,
        setError,
        search,
        setSearch,
        refresh,
        addQuote,
        deleteQuote
    } = useQuotes(guildId as string);

    const [authorId, setAuthorId] = useState("");
    const [quoteText, setQuoteText] = useState("");
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
                            { label: "shown", value: quotes.length },
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

                            <TextField label="Search quotes, people, or IDs" size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />

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
                                        const ok = await addQuote({ authorId, quote: quoteText, timestamp: Date.now() });
                                        if (ok) {
                                            setAuthorId("");
                                            setMemberInput("");
                                            setMemberOptions([]);
                                            setQuoteText("");
                                        }
                                    }}
                                    sx={{ ...primaryActionButtonSx(accent), whiteSpace: "nowrap", justifySelf: { xs: "stretch", lg: "end" } }}
                                >
                                    Add Quote
                                </Button>
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

                    <FeaturePanel accent={accent}>
                        {quotes.length === 0 ? (
                            <EmptyState icon={<FormatQuote />} title="No quotes yet" description="Add the first quote above to start building this server's quote archive." accent={accent} />
                        ) : (
                            <Stack spacing={1.5} sx={{ position: "relative" }}>
                                {quotes.map(q => {
                                    const author = userMap[q.authorId];
                                    const submitter = userMap[q.submitterId];
                                    return (
                                        <Box key={q.id} sx={{ ...dashboardCardSx(accent), display: "flex", alignItems: "flex-start", gap: 2, p: 2 }}>
                                            <FormatQuote sx={{ color: accent, mt: 0.5 }} />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body1" sx={{ color: "grey.50", fontWeight: 650 }}>
                                                    {q.quote}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                                                    by {getDisplayName(author)} | added by {getDisplayName(submitter)} | {formatTimestamp(q.timestamp)}
                                                </Typography>
                                            </Box>
                                            <Tooltip title="Delete quote">
                                                <span>
                                                    <IconButton color="error" disabled={saving} onClick={() => void deleteQuote(q.id)} sx={dangerActionButtonSx}>
                                                        <Delete />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
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
                    <CurationMetric icon={<Groups />} label="Quoted" value={summary.uniqueAuthors} accent={dashboardAccents.commands} />
                    <CurationMetric icon={<PersonSearch />} label="Curators" value={summary.uniqueSubmitters} accent={dashboardAccents.settings} />
                    <CurationMetric icon={<FormatQuote />} label="Duplicate Groups" value={duplicateGroups.length} accent={dashboardAccents.quotes} />
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
