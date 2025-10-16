"use client";
import React from "react";
import Link from "next/link";
import { Box, Typography, Alert, Grid, Paper, Button, Chip, Stack } from "@mui/material";
import { LiveTv, YouTube as YouTubeIcon, NotificationsActive, SpeakerNotes } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useTwitchConfigs } from "@/components/hooks/useTwitch";
import { useYouTubeConfigs } from "@/components/hooks/useYouTube";
import { usePatchSubscriptions } from "@/components/hooks/usePatchSubscriptions";

export default function GuildNotificationsHubPage() {
    const { guildId, guild, guildsLoading } = useGuildFromParams();
    const twitchApi = useTwitchConfigs(guildId as string);
    const youtubeApi = useYouTubeConfigs(guildId as string);
    const patchApi = usePatchSubscriptions(guildId as string);

    const loading = guildsLoading || twitchApi.loading || youtubeApi.loading || patchApi.loading;

    if (!guild && !guildsLoading) {
        return (
            <DashboardLayout>
                <Alert severity="error" sx={{ bgcolor: 'error.dark', color: 'error.light' }}>
                    Guild not found or you don't have access to this guild.
                </Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="lg" loading={loading}>
            {!loading && guild && (
                <>
                    <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <NotificationsActive color="primary" />
                        <Box>
                            <Typography variant="h4" sx={{ mb: 0.5, fontWeight: 600 }}>
                                Notifications
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Manage Twitch, YouTube and Patch Notes notifications for this server.
                            </Typography>
                        </Box>
                    </Box>

                    <Grid container spacing={3}>
                        <Grid sx={{ width: { xs: '100%', md: '33.333%' }, p: 1.5 }}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: 'grey.800', border: 1, borderColor: 'grey.700', height: '100%' }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <LiveTv color="secondary" />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Twitch Live Notifications</Typography>
                                    <Chip size="small" label={`${twitchApi.configs.length} configured`} sx={{ ml: 'auto' }} />
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Configure stream alerts: channel, destination, custom message, cooldown and quiet hours.
                                </Typography>
                                <Button
                                    component={Link}
                                    href={`/dashboard/twitch/${encodeURIComponent(guildId as string)}`}
                                    variant="contained"
                                    sx={{
                                        bgcolor: '#9146FF',
                                        '&:hover': { bgcolor: '#9146FF', filter: 'brightness(0.9)' }
                                    }}
                                >
                                    Manage Twitch
                                </Button>
                            </Paper>
                        </Grid>

                        <Grid sx={{ width: { xs: '100%', md: '33.333%' }, p: 1.5 }}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: 'grey.800', border: 1, borderColor: 'grey.700', height: '100%' }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <YouTubeIcon htmlColor="#FF0000" />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>YouTube Notifications</Typography>
                                    <Chip size="small" label={`${youtubeApi.configs.length} configured`} sx={{ ml: 'auto' }} />
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Configure video alerts: channel, destination, custom message, cooldown and quiet hours.
                                </Typography>
                                <Button
                                    component={Link}
                                    href={`/dashboard/youtube/${encodeURIComponent(guildId as string)}`}
                                    variant="contained"
                                    sx={{
                                        bgcolor: '#FF0000',
                                        '&:hover': { bgcolor: '#FF0000', filter: 'brightness(0.9)' }
                                    }}
                                >
                                    Manage YouTube
                                </Button>
                            </Paper>
                        </Grid>

                        <Grid sx={{ width: { xs: '100%', md: '33.333%' }, p: 1.5 }}>
                            <Paper elevation={2} sx={{ p: 3, borderRadius: 2, bgcolor: 'grey.800', border: 1, borderColor: 'grey.700', height: '100%' }}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <SpeakerNotes color="info" />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Patch Note Subscriptions</Typography>
                                    <Chip size="small" label={`${patchApi.configs.length} configured`} sx={{ ml: 'auto' }} />
                                </Stack>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Subscribe to game patch notes and post updates to specific channels.
                                </Typography>
                                <Button
                                    component={Link}
                                    href={`/dashboard/patch-notes/${encodeURIComponent(guildId as string)}`}
                                    variant="contained"
                                    sx={{
                                        bgcolor: '#7C4DFF',
                                        '&:hover': { bgcolor: '#7C4DFF', filter: 'brightness(0.9)' }
                                    }}
                                >
                                    Manage Patch Notes
                                </Button>
                            </Paper>
                        </Grid>
                    </Grid>
                </>
            )}
        </DashboardLayout>
    );
}
