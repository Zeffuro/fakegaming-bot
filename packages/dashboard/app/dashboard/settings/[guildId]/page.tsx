"use client";

import React from "react";
import Link from "next/link";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    ArrowForward,
    Block,
    Cake,
    FormatQuote,
    NotificationsActive,
    Settings,
    Timeline,
    Tune,
} from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { SettingsCard } from "@/components/SettingsCard";

interface SettingsDestination {
    title: string;
    description: string;
    href: string;
    accent: string;
    icon: React.ReactNode;
    actionLabel: string;
    chipLabel?: string;
}

interface ReviewStep {
    label: string;
    detail: string;
    href: string;
    accent: string;
}

export default function GuildSettingsPage() {
    const { guild, guildsLoading, guildId } = useGuildFromParams();
    const encodedGuildId = encodeURIComponent(guildId as string);

    if (!guild && !guildsLoading) {
        return <GuildAccessError />;
    }

    const destinations: SettingsDestination[] = [
        {
            title: "Notification Setup",
            description: "Manage feed routing, cooldowns, quiet hours, import/export, and duplicate setup review.",
            href: `/dashboard/settings/${encodedGuildId}/notifications`,
            accent: dashboardAccents.settings,
            icon: <NotificationsActive />,
            actionLabel: "Open Notifications",
            chipLabel: "Routing",
        },
        {
            title: "Delivery Analytics",
            description: "Review notification history, provider health, delivery rates, and 30-day provider trends.",
            href: `/dashboard/analytics/${encodedGuildId}`,
            accent: dashboardAccents.neutral,
            icon: <Timeline />,
            actionLabel: "Open Analytics",
            chipLabel: "Health",
        },
        {
            title: "Command Access",
            description: "Enable or disable bot modules and commands that are available to this server.",
            href: `/dashboard/commands/${encodedGuildId}`,
            accent: dashboardAccents.commands,
            icon: <Block />,
            actionLabel: "Manage Commands",
            chipLabel: "Access",
        },
        {
            title: "Quote Library",
            description: "View, add, search, and prune the quotes stored for this community.",
            href: `/dashboard/quotes/${encodedGuildId}`,
            accent: dashboardAccents.quotes,
            icon: <FormatQuote />,
            actionLabel: "Manage Quotes",
            chipLabel: "Content",
        },
        {
            title: "Birthday Calendar",
            description: "Maintain member birthdays and their announcement destinations.",
            href: `/dashboard/birthdays/${encodedGuildId}`,
            accent: dashboardAccents.birthdays,
            icon: <Cake />,
            actionLabel: "Manage Birthdays",
            chipLabel: "Community",
        },
        {
            title: "Server Overview",
            description: "Return to the full dashboard index for every available module on this server.",
            href: `/dashboard/${encodedGuildId}`,
            accent: dashboardAccents.anime,
            icon: <Tune />,
            actionLabel: "Open Overview",
            chipLabel: "Index",
        },
    ];

    const reviewSteps: ReviewStep[] = [
        {
            label: "Notification routing",
            detail: "Check where configured feeds post and clean up duplicate destinations.",
            href: `/dashboard/settings/${encodedGuildId}/notifications`,
            accent: dashboardAccents.settings,
        },
        {
            label: "Delivery health",
            detail: "Confirm recent sends and provider-specific failure patterns.",
            href: `/dashboard/analytics/${encodedGuildId}`,
            accent: dashboardAccents.neutral,
        },
        {
            label: "Command availability",
            detail: "Limit modules that should not be usable in this server.",
            href: `/dashboard/commands/${encodedGuildId}`,
            accent: dashboardAccents.commands,
        },
        {
            label: "Community content",
            detail: "Keep quotes and birthday announcements current.",
            href: `/dashboard/quotes/${encodedGuildId}`,
            accent: dashboardAccents.quotes,
        },
    ];

    return (
        <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={guildsLoading}>
            {!guildsLoading && guild && (
                <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.commands}>
                    <FeatureHero
                        icon={<Settings />}
                        eyebrow="Settings"
                        title="Server Control Center"
                        description="A hub for the settings that exist today: notification setup, delivery analytics, command availability, and community content."
                        accent={dashboardAccents.settings}
                        secondaryAccent={dashboardAccents.commands}
                        stats={[
                            { label: "Live Destinations", value: destinations.length },
                            { label: "Members", value: guild.member_count ?? "N/A" },
                        ]}
                        actions={(
                            <Button
                                component={Link}
                                href={`/dashboard/settings/${encodedGuildId}/notifications`}
                                variant="contained"
                                startIcon={<NotificationsActive />}
                                sx={primaryActionButtonSx(dashboardAccents.settings)}
                            >
                                Open Notifications
                            </Button>
                        )}
                    />

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.6fr) minmax(320px, 0.9fr)" }, gap: 3 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                            {destinations.map((destination) => (
                                <SettingsDestinationCard key={destination.title} destination={destination} />
                            ))}
                        </Box>

                        <Stack spacing={3}>
                            <SettingsCard
                                title="Server Snapshot"
                                description="Discord remains the source of truth for roles, channels, permissions, and member data."
                                accent={dashboardAccents.settings}
                            >
                                <Stack spacing={1.5}>
                                    <SnapshotRow label="Server" value={guild.name} />
                                    <SnapshotRow label="Server ID" value={guildId as string} />
                                    <SnapshotRow label="Members" value={String(guild.member_count ?? "N/A")} />
                                </Stack>
                            </SettingsCard>

                            <SettingsCard
                                title="Review Path"
                                description="Use this order when checking whether the bot setup still matches how the server is run."
                                accent={dashboardAccents.commands}
                            >
                                <Stack spacing={1.25}>
                                    {reviewSteps.map((step, index) => (
                                        <ReviewStepRow key={step.label} index={index + 1} step={step} />
                                    ))}
                                </Stack>
                            </SettingsCard>
                        </Stack>
                    </Box>
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}

function SettingsDestinationCard({ destination }: { destination: SettingsDestination }) {
    return (
        <SettingsCard
            title={destination.title}
            description={destination.description}
            accent={destination.accent}
        >
            <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            color: destination.accent,
                            bgcolor: alpha(destination.accent, 0.14),
                            border: `1px solid ${alpha(destination.accent, 0.28)}`,
                            flex: "0 0 auto",
                        }}
                    >
                        {destination.icon}
                    </Box>
                    {destination.chipLabel ? (
                        <Chip
                            size="small"
                            label={destination.chipLabel}
                            sx={{
                                color: "rgba(255,255,255,0.78)",
                                bgcolor: alpha(destination.accent, 0.10),
                                border: `1px solid ${alpha(destination.accent, 0.20)}`,
                            }}
                        />
                    ) : null}
                </Stack>

                <Button
                    component={Link}
                    href={destination.href}
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    sx={ghostActionButtonSx(destination.accent)}
                >
                    {destination.actionLabel}
                </Button>
            </Stack>
        </SettingsCard>
    );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, textAlign: "right", overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

function ReviewStepRow({ index, step }: { index: number; step: ReviewStep }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "32px minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    color: step.accent,
                    bgcolor: alpha(step.accent, 0.12),
                    border: `1px solid ${alpha(step.accent, 0.24)}`,
                    fontWeight: 900,
                }}
            >
                {index}
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "grey.50", fontWeight: 850 }}>
                    {step.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.48)" }}>
                    {step.detail}
                </Typography>
            </Box>
            <Button
                component={Link}
                href={step.href}
                variant="text"
                aria-label={`Open ${step.label}`}
                sx={{ ...ghostActionButtonSx(step.accent), minWidth: 40, px: 1.25 }}
            >
                <ArrowForward fontSize="small" />
            </Button>
        </Box>
    );
}
