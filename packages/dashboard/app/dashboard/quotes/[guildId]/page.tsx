"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Autocomplete, Avatar, Box, Button, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Add, Delete, FormatQuote } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, dashboardCardSx, dashboardFieldSx, dangerActionButtonSx, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useQuotes } from "@/components/hooks/useQuotes";
import { api } from "@/lib/api-client";

function formatTimestamp(ts: number): string {
    try {
        const d = new Date(Number(ts));
        if (Number.isNaN(d.getTime())) return String(ts);
        return d.toLocaleString();
    } catch {
        return String(ts);
    }
}

function getDisplayName(u?: ({ username?: string; global_name?: string | null } & ({ nickname?: string | null } | { nick?: string | null }))): string {
    if (!u) return "Unknown";
    if ("nickname" in u && u.nickname) return u.nickname;
    if ("nick" in u && (u as { nick?: string | null }).nick) return (u as { nick?: string | null }).nick || "Unknown";
    return u.global_name || u.username || "Unknown";
}

function buildAvatarUrl(userId: string, avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png`;
}

type MemberItem = { id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nick?: string | null };

export default function GuildQuotesPage() {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const {
        quotes,
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
        return (
            <DashboardLayout>
                <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>Guild not found or you don't have access to this guild.</Alert>
            </DashboardLayout>
        );
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
                        stats={[{ label: "quotes stored", value: quotes.length }]}
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

                            <TextField label="Search quotes" size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} sx={fieldSx} />

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
