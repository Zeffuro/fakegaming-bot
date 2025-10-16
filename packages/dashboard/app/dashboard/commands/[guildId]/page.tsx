"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { BOT_TREE } from "@/lib/commands";
import CommandToggle from "@/components/Commands/CommandToggle";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { useGuildModules } from "@/components/hooks/useGuildModules";
import { Box, Typography, Alert, Paper, Switch, Collapse, IconButton, Chip, Divider, Button, Stack } from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
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

  const {
    disabledModules,
    fetchDisabledModules,
    loadingModule,
    disableModule,
    enableModule,
  } = useGuildModules(guildId as string);

  useEffect(() => {
    if (guildId) {
      fetchDisabledCommands();
      fetchDisabledModules();
    }
  }, [guildId, fetchDisabledCommands, fetchDisabledModules]);

  // track collapsed state per module
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const node of BOT_TREE) next[node.module.name] = value;
    setCollapsed(next);
  };
  const toggleCollapsed = (moduleName: string) => {
    setCollapsed(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  // derive quick lookup for disabled commands
  const disabledSet = useMemo(() => new Set(disabledCommands), [disabledCommands]);

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
          Enable or disable bot commands for this server. Disabling a module will disable all of its commands.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button size="small" variant="outlined" onClick={() => setAll(false)}>Expand all</Button>
        <Button size="small" variant="outlined" onClick={() => setAll(true)}>Collapse all</Button>
      </Stack>

      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        {BOT_TREE.map((node, _idx) => {
          const moduleName = node.module.name;
          const moduleDisabled = disabledModules.includes(moduleName);
          const isCollapsed = !!collapsed[moduleName];
          if (node.commands.length === 0) return null;

          const total = node.commands.length;
          const enabledCount = moduleDisabled ? 0 : node.commands.filter(c => !disabledSet.has(c.name)).length;
          const headerChip = moduleDisabled ? "Module disabled" : `${enabledCount}/${total} enabled`;

          return (
            <Box key={moduleName} sx={{ mb: 2, border: 1, borderColor: 'grey.700', borderRadius: 1, bgcolor: 'grey.900' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small" onClick={() => toggleCollapsed(moduleName)} aria-label={isCollapsed ? `Expand ${node.module.title}` : `Collapse ${node.module.title}`}>
                    {isCollapsed ? <ExpandMore /> : <ExpandLess />}
                  </IconButton>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {node.module.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {node.module.description}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label={headerChip} color={moduleDisabled ? 'warning' : 'default'} />
                  <Switch
                    edge="end"
                    checked={!moduleDisabled}
                    onChange={(_, checked) => {
                      if (checked) enableModule(moduleName); else disableModule(moduleName);
                    }}
                    disabled={loadingModule === moduleName}
                    slotProps={{ input: { "aria-label": `Enable/disable ${node.module.title} module` } }}
                  />
                </Box>
              </Box>
              <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                <Divider />
                <Box sx={{ p: 1.5 }}>
                  {node.commands.map(cmd => {
                    const commandDisabled = disabledSet.has(cmd.name);
                    const effectiveDisabled = moduleDisabled || commandDisabled;
                    return (
                      <CommandToggle
                        key={cmd.name}
                        name={cmd.name}
                        description={cmd.description}
                        disabled={effectiveDisabled}
                        interactiveDisabled={moduleDisabled}
                        onToggle={enabled => {
                          if (enabled) enableCommand(cmd.name);
                          else disableCommand(cmd.name);
                        }}
                        loading={loadingCommand === cmd.name}
                      />
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Paper>
    </DashboardLayout>
  );
}
