"use client";
import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { BOT_COMMANDS } from "@/lib/commands";
import CommandList from "@/components/Commands/CommandList";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { Box, Typography, Container, CircularProgress, Alert } from "@mui/material";

export default function GuildCommandsPage() {
  const { guildId } = useParams();
  const { user, loading: userLoading, isAdmin, guilds } = useDashboardData();
  const guild = guilds.find(g => g.id === guildId);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
  const {
    disabledCommands,
    loadingCommand,
    fetchDisabledCommands,
    disableCommand,
    enableCommand,
  } = useGuildCommands(guildId as string, token);

  useEffect(() => {
    fetchDisabledCommands();
  }, [guildId]);

  if (userLoading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;
  if (!user) return <Box sx={{ p: 4 }}><Alert severity="error">Not authenticated.</Alert></Box>;
  if (!guild) return <Box sx={{ p: 4 }}><Alert severity="error">Guild not found.</Alert></Box>;

  return (
    <>
      <Container maxWidth="md">
        <Typography variant="h5" sx={{ mb: 2 }}>
          Manage Commands for <b>{guild.name}</b>
        </Typography>
        <CommandList
          commands={BOT_COMMANDS}
          disabledCommands={disabledCommands}
          loadingCommand={loadingCommand ?? undefined}
          onToggle={(commandName, enabled) => {
            if (enabled) enableCommand(commandName);
            else disableCommand(commandName);
          }}
        />
      </Container>
    </>
  );
}
