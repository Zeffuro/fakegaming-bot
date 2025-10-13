"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { useQuotes } from "@/components/hooks/useQuotes";
import { Box, Typography, Alert, Paper, TextField, Button, IconButton, Divider, Stack, Tooltip } from "@mui/material";
import { FormatQuote, Delete, Add } from "@mui/icons-material";
import { useUserData } from "@/components/hooks/useUserData";

function formatTimestamp(ts: number): string {
    try {
        const d = new Date(Number(ts));
        if (Number.isNaN(d.getTime())) return String(ts);
        return d.toLocaleString();
    } catch {
        return String(ts);
    }
}

function getDisplayName(u?: { username?: string; global_name?: string | null; nickname?: string | null }): string {
    if (!u) return "Unknown";
    return u.nickname || u.global_name || u.username || "Unknown";
}

export default function GuildQuotesPage() {
    const { guildId } = useParams();
    const { guilds } = useDashboardData();
    const { user } = useUserData();
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
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                            <TextField
                                label="Author ID"
                                placeholder="Discord user ID"
                                size="small"
                                value={authorId}
                                onChange={(e) => setAuthorId(e.target.value)}
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                label="Quote"
                                placeholder="Add a new quote..."
                                size="small"
                                value={quoteText}
                                onChange={(e) => setQuoteText(e.target.value)}
                                sx={{ flex: 3 }}
                            />
                            <Button
                                variant="contained"
                                startIcon={<Add />}
                                disabled={saving || !authorId || !quoteText}
                                onClick={async () => {
                                    const ok = await addQuote({ authorId, quote: quoteText, timestamp: Date.now() });
                                    if (ok) {
                                        setAuthorId("");
                                        setQuoteText("");
                                    }
                                }}
                            >
                                Add Quote
                            </Button>
                        </Stack>
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
