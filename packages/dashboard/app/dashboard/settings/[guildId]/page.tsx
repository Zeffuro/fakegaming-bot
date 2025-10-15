"use client";
import React from "react";
import { Box, Typography, Alert, Grid, Button } from "@mui/material";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { SettingsCard } from "@/components/SettingsCard";
import { SettingsToggleList } from "@/components/SettingsToggleList";

export default function GuildSettingsPage() {
  const { guild, guildsLoading, guildId } = useGuildFromParams();

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error">Guild not found or you don't have access to this guild.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="settings" maxWidth="md" loading={guildsLoading}>
      {!guildsLoading && guild && (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
              Server Settings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure bot behavior and features for this server.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid sx={{ width: '100%', p: 1.5 }}>
              <SettingsCard title="General Settings">
                <SettingsToggleList items={[
                  { label: "Enable welcome messages", defaultChecked: true },
                  { label: "Auto-moderation", defaultChecked: true },
                  { label: "Level system", defaultChecked: false }
                ]} />
              </SettingsCard>
            </Grid>

            <Grid sx={{ width: '100%', p: 1.5 }}>
              <SettingsCard title="Notification Settings">
                <SettingsToggleList items={[
                  { label: "Game notifications", defaultChecked: true },
                  { label: "Event reminders", defaultChecked: false },
                  { label: "Member join/leave notifications", defaultChecked: true }
                ]} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    component={Link}
                    href={`/dashboard/settings/${encodeURIComponent(guildId as string)}/notifications`}
                    variant="contained"
                    color="primary"
                    sx={{ borderRadius: 2 }}
                  >
                    Open Notifications Settings
                  </Button>
                </Box>
              </SettingsCard>
            </Grid>

            <Grid sx={{ width: '100%', p: 1.5 }}>
              <SettingsCard
                title="Advanced Settings"
                description="These settings require administrator permissions."
              >
                <SettingsToggleList items={[
                  { label: "Bot debug mode", defaultChecked: false, disabled: true },
                  { label: "Advanced logging", defaultChecked: false, disabled: true }
                ]} />
              </SettingsCard>
            </Grid>
          </Grid>
        </>
      )}
    </DashboardLayout>
  );
}
