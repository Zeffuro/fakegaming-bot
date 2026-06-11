"use client";
import React from "react";
import Link from "next/link";
import { Alert, Box, Button } from "@mui/material";
import { NotificationsActive, Settings } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { SettingsCard } from "@/components/SettingsCard";
import { SettingsToggleList } from "@/components/SettingsToggleList";

export default function GuildSettingsPage() {
  const { guild, guildsLoading, guildId } = useGuildFromParams();
  const encodedGuildId = encodeURIComponent(guildId as string);

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>Guild not found or you don't have access to this guild.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="settings" maxWidth="xl" loading={guildsLoading}>
      {!guildsLoading && guild && (
        <FeatureShell accent={dashboardAccents.settings} secondaryAccent={dashboardAccents.commands}>
          <FeatureHero
            icon={<Settings />}
            eyebrow="Settings"
            title="Server settings"
            description="Configure server-level bot behavior, notification entry points, and admin-only controls from one coherent settings surface."
            accent={dashboardAccents.settings}
            secondaryAccent={dashboardAccents.commands}
            actions={(
              <Button
                component={Link}
                href={`/dashboard/settings/${encodedGuildId}/notifications`}
                variant="contained"
                startIcon={<NotificationsActive />}
                sx={primaryActionButtonSx(dashboardAccents.settings)}
              >
                Open notifications
              </Button>
            )}
          />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
            <SettingsCard title="General settings">
              <SettingsToggleList items={[
                { label: "Enable welcome messages", defaultChecked: true },
                { label: "Auto-moderation", defaultChecked: true },
                { label: "Level system", defaultChecked: false }
              ]} />
            </SettingsCard>

            <SettingsCard title="Notification settings" description="Notification modules have their own pages because they need channel routing, cooldowns, and provider-specific metadata." accent={dashboardAccents.anime}>
              <SettingsToggleList items={[
                { label: "Game notifications", defaultChecked: true },
                { label: "Event reminders", defaultChecked: false },
                { label: "Member join/leave notifications", defaultChecked: true }
              ]} />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <Button component={Link} href={`/dashboard/settings/${encodedGuildId}/notifications`} variant="contained" sx={primaryActionButtonSx(dashboardAccents.anime)}>
                  Notification command center
                </Button>
              </Box>
            </SettingsCard>

            <SettingsCard title="Advanced settings" description="These settings require administrator permissions and are intentionally locked until the backend behavior exists." accent={dashboardAccents.admin}>
              <SettingsToggleList items={[
                { label: "Bot debug mode", defaultChecked: false, disabled: true },
                { label: "Advanced logging", defaultChecked: false, disabled: true }
              ]} />
            </SettingsCard>
          </Box>
        </FeatureShell>
      )}
    </DashboardLayout>
  );
}
