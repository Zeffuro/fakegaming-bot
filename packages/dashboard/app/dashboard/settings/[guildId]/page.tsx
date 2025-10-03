"use client";
import React from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { Box, Typography, Alert, Paper, Grid, Switch, FormControlLabel } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";

export default function GuildSettingsPage() {
  const { guildId } = useParams();
  const { guilds } = useDashboardData();
  const guild = guilds.find(g => g.id === guildId);

  if (!guild) {
    return (
      <DashboardLayout>
        <Alert severity="error">Guild not found or you don't have access to this guild.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="settings" maxWidth="md">
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
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              General Settings
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Enable welcome messages"
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Auto-moderation"
              />
              <FormControlLabel
                control={<Switch />}
                label="Level system"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid sx={{ width: '100%', p: 1.5 }}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Notification Settings
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Game notifications"
              />
              <FormControlLabel
                control={<Switch />}
                label="Event reminders"
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Member join/leave notifications"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid sx={{ width: '100%', p: 1.5 }}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Advanced Settings
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These settings require administrator permissions.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControlLabel
                control={<Switch />}
                label="Bot debug mode"
                disabled
              />
              <FormControlLabel
                control={<Switch />}
                label="Advanced logging"
                disabled
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </DashboardLayout>
  );
}
