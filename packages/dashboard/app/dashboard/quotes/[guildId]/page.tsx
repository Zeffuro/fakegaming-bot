"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { useQuotes } from "@/components/hooks/useQuotes";
import { Box, Typography, Alert, Paper, TextField, Button, IconButton, Divider, Stack, Tooltip, Autocomplete, Avatar, CircularProgress } from "@mui/material";
import { FormatQuote, Delete, Add } from "@mui/icons-material";
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
    // Discord CDN user avatar URL
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(avatar)}.png`;
}

export default function GuildQuotesPage() {
    const { guildId } = useParams();
    const { guilds } = useDashboardData();
    const guild = guilds.find(g => g.id === guildId);

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

    // Autocomplete state
    type MemberItem = { id: string; username?: string; global_name?: string | null; discriminator?: string | null; avatar?: string | null; nick?: string | null };
    const [memberInput, setMemberInput] = useState<string>("");
    const [memberOptions, setMemberOptions] = useState<MemberItem[]>([]);
    const [memberLoading, setMemberLoading] = useState<boolean>(false);

    // Local in-memory cache to reduce API calls and Redis churn (TTL ~2 minutes)
    const memberSearchCacheRef = React.useRef<Map<string, { ts: number; items: MemberItem[] }>>(new Map());

    const inputLooksLikeId = useMemo(() => /^(\d{5,})$/.test(memberInput.trim()), [memberInput]);

    useEffect(() => {
        // Keep authorId in sync when user types a raw ID
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
        const TTL_MS = 2 * 60 * 1000; // 2 minutes
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
                // store in local cache
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
        // on initial, ensure fetch
        void refresh();
    }, [refresh]);

    // Note: user resolution happens inside the useQuotes hook when quotes change

    if (!guild) {
        return (
            <DashboardLayout>
                <Alert severity="error">Guild not found or you don't have access to this guild.</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout guild={guild} currentModule="quotes" maxWidth="lg" loading={loading}>
            {!loading && (
                <>
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2, color: 'grey.100' }}>
                            <FormatQuote color="secondary" />
                            Quotes
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'grey.300' }}>
                            View, search, add, and delete quotes for this server. Usernames are resolved securely using the bot with minimal caching.
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3, bgcolor: 'error.dark', color: 'error.light' }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: 'grey.800', border: 1, borderColor: 'grey.700', mb: 3 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                            <TextField
                                label="Search quotes"
                                size="small"
                                fullWidth
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving}>Refresh</Button>
                        </Box>
                        <Divider sx={{ my: 2 }} />
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '2fr 3fr auto' },
                                gap: 2,
                                alignItems: 'center',
                                width: '100%'
                            }}
                        >
                            <Autocomplete<MemberItem, false, false, true>
                                freeSolo
                                fullWidth
                                options={memberOptions}
                                inputValue={memberInput}
                                onInputChange={(_e, value) => setMemberInput(value)}
                                onChange={(_e, newValue) => {
                                    const opt = (newValue as MemberItem | string | null);
                                    if (opt && typeof opt !== 'string' && opt.id) {
                                        setAuthorId(opt.id);
                                        setMemberInput(`${getDisplayName(opt)} (${opt.id})`);
                                    }
                                }}
                                getOptionLabel={(opt) => typeof opt === 'string' ? opt : getDisplayName(opt)}
                                loading={memberLoading}
                                noOptionsText={memberInput.trim().length < 3 ? 'Type at least 3 characters' : 'No members found'}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Author"
                                        placeholder="Type a name, nickname, or paste a Discord user ID"
                                        size="small"
                                        fullWidth
                                        sx={{
                                            '& .MuiInputLabel-root': { color: 'grey.300' },
                                            '& .MuiOutlinedInput-root': {
                                                color: 'grey.100',
                                                '& fieldset': { borderColor: 'grey.600' },
                                                '&:hover fieldset': { borderColor: 'grey.500' },
                                                '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                            }
                                        }}
                                        slotProps={{
                                            input: {
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {memberLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                )
                                            }
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => {
                                    const item = option as MemberItem;
                                    const avatarUrl = buildAvatarUrl(item.id, item.avatar ?? null);
                                    // Avoid React 19 warning: extract key from props and pass explicitly
                                    const { key: liKey, ...liProps } = (props as unknown as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>);
                                    return (
                                        <li key={liKey} {...liProps}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar src={avatarUrl ?? undefined} sx={{ width: 24, height: 24 }}>
                                                    {getDisplayName(item).slice(0, 1).toUpperCase()}
                                                </Avatar>
                                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Typography variant="body2" sx={{ color: 'grey.100' }}>{getDisplayName(item)}</Typography>
                                                    <Typography variant="caption" sx={{ color: 'grey.500' }}>{item.username}{item.discriminator ? `#${item.discriminator}` : ''} • {item.id}</Typography>
                                                </Box>
                                            </Box>
                                        </li>
                                    );
                                }}
                                sx={{ width: '100%' }}
                            />

                            <TextField
                                label="Quote"
                                placeholder="Add a new quote..."
                                size="small"
                                value={quoteText}
                                onChange={(e) => setQuoteText(e.target.value)}
                                fullWidth
                                sx={{
                                    '& .MuiInputLabel-root': { color: 'grey.300' },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'grey.100',
                                        '& fieldset': { borderColor: 'grey.600' },
                                        '&:hover fieldset': { borderColor: 'grey.500' },
                                        '&.Mui-focused fieldset': { borderColor: 'primary.main' }
                                    }
                                }}
                            />

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
                                sx={{ whiteSpace: 'nowrap', justifySelf: { xs: 'stretch', md: 'end' } }}
                            >
                                Add Quote
                            </Button>
                        </Box>
                    </Paper>

                    <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: 'grey.800', border: 1, borderColor: 'grey.700' }}>
                        {quotes.length === 0 ? (
                            <Typography variant="body1" sx={{ color: 'grey.400' }}>No quotes yet. Add the first one above.</Typography>
                        ) : (
                            <Stack spacing={2}>
                                {quotes.map(q => {
                                    const author = userMap[q.authorId];
                                    const submitter = userMap[q.submitterId];
                                    return (
                                        <Box key={q.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 2, borderRadius: 1, bgcolor: 'grey.900', border: 1, borderColor: 'grey.700' }}>
                                            <FormatQuote sx={{ color: 'grey.500', mt: 0.5 }} />
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body1" sx={{ color: 'grey.100' }}>
                                                    {q.quote}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'grey.400' }}>
                                                    by {getDisplayName(author)} • added by {getDisplayName(submitter)} • {formatTimestamp(q.timestamp)}
                                                </Typography>
                                            </Box>
                                            <Tooltip title="Delete quote">
                                                <span>
                                                    <IconButton color="error" disabled={saving} onClick={() => void deleteQuote(q.id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Paper>
                </>
            )}
        </DashboardLayout>
    );
}
