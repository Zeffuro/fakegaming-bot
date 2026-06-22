"use client";
import React, { useState } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { AdminPanelSettings, Groups, NoteAlt, Refresh } from "@mui/icons-material";
import GuildCard from "@/components/Guild/GuildCard";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";

export default function Dashboard() {
    const { guilds, isAdmin, loading, error, refetch } = useDashboardData();
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const handleGuildClick = (guild: any) => {
        router.push(`/dashboard/${guild.id}`);
    };

    const handleRefreshGuilds = async () => {
        setRefreshing(true);
        try {
            await refetch({ refresh: true });
        } finally {
            setRefreshing(false);
        }
    };

    if (error) {
        return (
            <DashboardLayout>
                <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>{error}</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout loading={loading} maxWidth="xl">
            {!loading && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.anime}>
                    <FeatureHero
                        icon={<Groups />}
                        eyebrow={isAdmin ? "Full access" : "Guilds"}
                        title="Your guilds"
                        description="Pick a server to configure bot modules, notifications, commands, quotes, birthdays, and anime reminders."
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.anime}
                        stats={[{ label: "guilds available", value: guilds.length }]}
                        actions={(
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                <Button
                                    variant="outlined"
                                    startIcon={<NoteAlt />}
                                    onClick={() => router.push("/dashboard/me")}
                                    sx={{
                                        borderColor: "rgba(255,255,255,0.18)",
                                        color: "grey.100",
                                        textTransform: "none",
                                        fontWeight: 800,
                                        borderRadius: 2,
                                        bgcolor: "rgba(255,255,255,0.04)",
                                        '&:hover': {
                                            borderColor: "rgba(255,255,255,0.34)",
                                            bgcolor: "rgba(255,255,255,0.08)"
                                        }
                                    }}
                                >
                                    Your dashboard
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Refresh />}
                                    onClick={handleRefreshGuilds}
                                    disabled={loading || refreshing}
                                    sx={{
                                        borderColor: "rgba(255,255,255,0.18)",
                                        color: "grey.100",
                                        textTransform: "none",
                                        fontWeight: 800,
                                        borderRadius: 2,
                                        bgcolor: "rgba(255,255,255,0.04)",
                                        '&:hover': {
                                            borderColor: "rgba(255,255,255,0.34)",
                                            bgcolor: "rgba(255,255,255,0.08)"
                                        }
                                    }}
                                >
                                    Refresh servers
                                </Button>
                                {isAdmin && (
                                    <Button variant="contained" startIcon={<AdminPanelSettings />} onClick={() => router.push("/dashboard/admin")} sx={primaryActionButtonSx(dashboardAccents.admin)}>
                                        Admin panel
                                    </Button>
                                )}
                            </Stack>
                        )}
                    />

                    <FeaturePanel accent={dashboardAccents.commands} sx={{ mb: 3 }}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ position: "relative", alignItems: { md: "center" }, justifyContent: "space-between" }}>
                            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                                <Box sx={{ width: 46, height: 46, borderRadius: 2, display: "grid", placeItems: "center", color: "grey.50", bgcolor: "rgba(104,215,255,0.16)" }}>
                                    <NoteAlt />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 900 }}>
                                        Personal tools
                                    </Typography>
                                    <Typography sx={{ color: "rgba(255,255,255,0.62)" }}>
                                        Notes and other account-level features that are not tied to a server.
                                    </Typography>
                                </Box>
                            </Stack>
                            <Button
                                variant="contained"
                                startIcon={<NoteAlt />}
                                onClick={() => router.push("/dashboard/me")}
                                sx={primaryActionButtonSx(dashboardAccents.commands)}
                            >
                                Open personal tools
                            </Button>
                        </Stack>
                    </FeaturePanel>

                    <FeaturePanel accent={dashboardAccents.settings}>
                        <Stack spacing={2} sx={{ position: "relative" }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                                {guilds.map(guild => (
                                    <GuildCard key={guild.id} guild={guild} onClick={() => handleGuildClick(guild)} />
                                ))}
                            </Box>
                        </Stack>
                    </FeaturePanel>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}
