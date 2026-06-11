"use client";
import React from "react";
import { Alert, Box, Button, Stack } from "@mui/material";
import { AdminPanelSettings, Groups } from "@mui/icons-material";
import GuildCard from "@/components/Guild/GuildCard";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useRouter } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";

export default function Dashboard() {
    const { guilds, isAdmin, loading, error } = useDashboardData();
    const router = useRouter();

    const handleGuildClick = (guild: any) => {
        router.push(`/dashboard/${guild.id}`);
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
                        actions={isAdmin ? (
                            <Button variant="contained" startIcon={<AdminPanelSettings />} onClick={() => router.push("/dashboard/admin")} sx={primaryActionButtonSx(dashboardAccents.admin)}>
                                Admin panel
                            </Button>
                        ) : undefined}
                    />

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
