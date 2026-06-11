"use client";

import React, { useState } from "react";
import { AdminPage } from "@/components/AdminPage";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import {
    dashboardAccents,
    dashboardFieldSx,
    ghostActionButtonSx,
    primaryActionButtonSx,
} from "@/components/dashboard/dashboardTheme";
import { useAsyncTask } from "@/components/hooks/useAsync";
import { api } from "@/lib/api-client";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Link,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { OpenInNew, Search, VideoLibrary, YouTube } from "@mui/icons-material";

interface YouTubeLookupResult {
    channelId: string | null;
    title: string | null;
    url: string | null;
    latestVideoId: string | null;
}

export default function AdminYouTubeDebugPage() {
    const accent = dashboardAccents.youtube;
    const [identifier, setIdentifier] = useState<string>("");
    const { submitting, result, error, setError, reset, run } = useAsyncTask<YouTubeLookupResult>();

    const handleResolve = async () => {
        const id = identifier.trim();
        if (!id) {
            setError("Please enter a YouTube identifier, handle, username, or UC channel ID.");
            return;
        }

        await run(async () => {
            const resolved = await api.resolveYouTubeIdentifier(id);
            const channelId = resolved.channelId ?? null;
            if (!channelId) {
                return { channelId: null, title: null, url: null, latestVideoId: null };
            }

            const metadata = await api.getYouTubeChannelMetadata(channelId);
            return {
                channelId,
                title: metadata.title,
                url: metadata.url,
                latestVideoId: metadata.latestVideoId,
            };
        });
    };

    const channelUrl = result?.url ?? (result?.channelId ? `https://www.youtube.com/channel/${result.channelId}` : null);
    const latestVideoUrl = result?.latestVideoId ? `https://www.youtube.com/watch?v=${result.latestVideoId}` : null;

    return (
        <AdminPage title="Admin YouTube Debug" trail={[{ label: "YouTube Debug", href: "/dashboard/admin/youtube" }]}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(340px, 0.95fr) minmax(0, 1.35fr)" }, gap: 2.5 }}>
                <FeaturePanel accent={accent} sx={{ p: 3, alignSelf: "start" }}>
                    <Stack spacing={2.25} sx={{ position: "relative" }}>
                        <Stack spacing={0.8}>
                            <Chip
                                icon={<YouTube />}
                                label="Tokenless lookup"
                                sx={{ alignSelf: "flex-start", bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.42)}` }}
                            />
                            <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: "-0.03em" }}>
                                Resolve a channel
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
                                Handles and usernames use the configured YouTube API key when available. UC channel IDs also get a no-token metadata pass through YouTube's public Atom feed.
                            </Typography>
                        </Stack>

                        <TextField
                            label="YouTube identifier"
                            placeholder="@GoogleDevelopers, GoogleDevelopers, or UC..."
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleResolve();
                            }}
                            fullWidth
                            sx={dashboardFieldSx(accent)}
                        />

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                            <Button variant="contained" onClick={() => void handleResolve()} disabled={submitting} startIcon={<Search />} sx={primaryActionButtonSx(accent)}>
                                {submitting ? "Resolving..." : "Resolve"}
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setIdentifier("");
                                    reset();
                                }}
                                disabled={submitting}
                                sx={ghostActionButtonSx(accent)}
                            >
                                Clear
                            </Button>
                        </Stack>

                        {error && (
                            <Alert severity="error" sx={{ bgcolor: alpha(dashboardAccents.quotes, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.quotes, 0.22)}` }}>
                                {error}
                            </Alert>
                        )}
                    </Stack>
                </FeaturePanel>

                <FeaturePanel accent={accent} sx={{ p: 3, minHeight: 330 }}>
                    <Stack spacing={2.25} sx={{ position: "relative" }}>
                        <Stack direction="row" spacing={1.4} sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0 }}>
                                <Box sx={{ color: accent, display: "grid", placeItems: "center" }}>
                                    <VideoLibrary />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="h5" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: "-0.03em" }}>
                                        {result?.title ?? "Channel preview"}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.55)" }}>
                                        {result?.channelId ?? "Resolve a channel to see public metadata here."}
                                    </Typography>
                                </Box>
                            </Stack>
                            {result?.title && (
                                <Chip label="feed matched" size="small" sx={{ bgcolor: alpha(dashboardAccents.settings, 0.14), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.settings, 0.34)}` }} />
                            )}
                        </Stack>

                        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

                        {!result ? (
                            <EmptyLookup />
                        ) : result.channelId ? (
                            <Stack spacing={1.3}>
                                <InfoRow label="Channel ID" value={result.channelId} />
                                <InfoRow label="Channel name" value={result.title ?? "Unavailable from public feed"} />
                                <InfoRow label="Latest video" value={result.latestVideoId ?? "No recent public feed entry"} />

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1} sx={{ pt: 0.8 }}>
                                    {channelUrl && (
                                        <Button
                                            component={Link}
                                            href={channelUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            startIcon={<OpenInNew />}
                                            sx={ghostActionButtonSx(accent)}
                                        >
                                            Open channel
                                        </Button>
                                    )}
                                    {latestVideoUrl && (
                                        <Button
                                            component={Link}
                                            href={latestVideoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            startIcon={<OpenInNew />}
                                            sx={ghostActionButtonSx(accent)}
                                        >
                                            Open latest video
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        ) : (
                            <Alert severity="warning" sx={{ bgcolor: alpha(dashboardAccents.birthdays, 0.12), color: "grey.50", border: `1px solid ${alpha(dashboardAccents.birthdays, 0.22)}` }}>
                                No channel ID resolved. If this was a handle, set YOUTUBE_API_KEY for handle resolution, or paste a UC channel ID directly.
                            </Alert>
                        )}
                    </Stack>
                </FeaturePanel>
            </Box>
        </AdminPage>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", p: 1.35, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 750, overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function EmptyLookup() {
    return (
        <Stack spacing={1.1} sx={{ minHeight: 160, alignItems: "center", justifyContent: "center", textAlign: "center", color: "rgba(255,255,255,0.52)" }}>
            <YouTube sx={{ fontSize: 42, opacity: 0.48 }} />
            <Typography variant="body2">
                Paste a channel ID to get a tokenless title lookup, or resolve a handle if an API key is configured.
            </Typography>
        </Stack>
    );
}
