"use client";
import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { BOT_COMMANDS } from "@/lib/commands";
import CommandList from "@/components/Commands/CommandList";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { Box, Typography, Alert, Paper } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";

export default function GuildCommandsPage() {
  const { guildId } = useParams();
  const { guilds } = useDashboardData();
  const guild = guilds.find(g => g.id === guildId);
  const {
    disabledCommands,
    loadingCommand,
    fetchDisabledCommands,
    disableCommand,
    enableCommand,
    error
  } = useGuildCommands(guildId as string);

  useEffect(() => {
    if (guildId) {
      fetchDisabledCommands();
    }
  }, [guildId, fetchDisabledCommands]);

  if (!guild) {
    return (
      <DashboardLayout>
        <Alert severity="error">Guild not found or you don't have access to this guild.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="commands" maxWidth="md">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Command Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Enable or disable bot commands for this server. Disabled commands will not be available to server members.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <CommandList
          commands={BOT_COMMANDS}
          disabledCommands={disabledCommands}
          loadingCommand={loadingCommand ?? undefined}
          onToggle={(commandName, enabled) => {
            if (enabled) enableCommand(commandName);
            else disableCommand(commandName);
          }}
        />
      </Paper>
    </DashboardLayout>
  );
}
