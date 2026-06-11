"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Collapse, Divider, IconButton, InputAdornment, Stack, Switch, TextField, Typography } from "@mui/material";
import { Block, ExpandLess, ExpandMore, Search } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import CommandToggle from "@/components/Commands/CommandToggle";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildModules } from "@/components/hooks/useGuildModules";
import { BOT_TREE } from "@/lib/commands";

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function GuildCommandsPage() {
  const { guildId, guild, guildsLoading } = useGuildFromParams();
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

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const node of BOT_TREE) next[node.module.name] = value;
    setCollapsed(next);
  };
  const toggleCollapsed = (moduleName: string) => {
    setCollapsed(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const disabledSet = useMemo(() => new Set(disabledCommands), [disabledCommands]);
  const totalCommands = BOT_TREE.reduce((sum, node) => sum + node.commands.length, 0);
  const enabledCommands = totalCommands - disabledCommands.length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTree = useMemo(() => {
    if (!normalizedSearch) return BOT_TREE;
    return BOT_TREE.map(node => {
      const moduleMatches = [
        node.module.name,
        node.module.title,
        node.module.description,
      ].some(value => value.toLowerCase().includes(normalizedSearch));
      const commands = moduleMatches
        ? node.commands
        : node.commands.filter(command => [
          command.name,
          toTitleCase(command.name),
          command.description,
        ].some(value => value.toLowerCase().includes(normalizedSearch)));
      return { ...node, commands };
    }).filter(node => node.commands.length > 0);
  }, [normalizedSearch]);
  const filteredCommandCount = filteredTree.reduce((sum, node) => sum + node.commands.length, 0);

  if (!guild && !guildsLoading) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>Guild not found or you don't have access to this guild.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout guild={guild} currentModule="commands" maxWidth="xl" loading={guildsLoading}>
      {guild && (
        <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.settings}>
          <FeatureHero
            icon={<Block />}
            eyebrow="Commands"
            title="Command Management"
            description="Enable or disable bot modules and individual commands without losing visibility into what each module contains."
            accent={dashboardAccents.commands}
            secondaryAccent={dashboardAccents.settings}
            stats={[
              { label: "Commands Enabled", value: `${enabledCommands}/${totalCommands}` },
              { label: "Modules Disabled", value: disabledModules.length },
            ]}
            actions={(
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", lg: "flex-end" }, rowGap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setAll(false)} sx={ghostActionButtonSx(dashboardAccents.commands)}>Expand all</Button>
                <Button size="small" variant="outlined" onClick={() => setAll(true)} sx={ghostActionButtonSx(dashboardAccents.commands)}>Collapse all</Button>
              </Stack>
            )}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(255,107,154,0.12)", color: "grey.50", border: "1px solid rgba(255,107,154,0.24)" }}>
              {error}
            </Alert>
          )}

          <FeaturePanel accent={dashboardAccents.commands}>
            <Stack spacing={2} sx={{ position: "relative" }}>
              <TextField
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search commands"
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: "rgba(255,255,255,0.48)" }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  maxWidth: 520,
                  "& .MuiOutlinedInput-root": {
                    color: "grey.100",
                    bgcolor: "rgba(255,255,255,0.045)",
                    borderRadius: 2,
                    "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.24)" },
                    "&.Mui-focused fieldset": { borderColor: dashboardAccents.commands },
                  },
                  "& input::placeholder": { color: "rgba(255,255,255,0.48)", opacity: 1 },
                }}
              />
              {normalizedSearch && (
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                  Showing {filteredCommandCount} {filteredCommandCount === 1 ? "command" : "commands"}
                </Typography>
              )}
              {filteredTree.length === 0 && (
                <Alert severity="info" sx={{ bgcolor: "rgba(104,215,255,0.10)", color: "grey.100", border: "1px solid rgba(104,215,255,0.20)" }}>
                  No commands match your search.
                </Alert>
              )}
              {filteredTree.map((node) => {
                const moduleName = node.module.name;
                const moduleDisabled = disabledModules.includes(moduleName);
                const isCollapsed = !!collapsed[moduleName];
                if (node.commands.length === 0) return null;

                const total = node.commands.length;
                const enabledCount = moduleDisabled ? 0 : node.commands.filter(c => !disabledSet.has(c.name)).length;
                const headerChip = moduleDisabled ? "Module disabled" : `${enabledCount}/${total} enabled`;

                return (
                  <Box key={moduleName} sx={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 3, bgcolor: "rgba(8,13,22,0.72)", overflow: "hidden" }}>
                    <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 2, p: 2, flexWrap: { xs: "wrap", md: "nowrap" } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                        <IconButton size="small" onClick={() => toggleCollapsed(moduleName)} aria-label={isCollapsed ? `Expand ${node.module.title}` : `Collapse ${node.module.title}`} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                          {isCollapsed ? <ExpandMore /> : <ExpandLess />}
                        </IconButton>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            {node.module.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                            {node.module.description}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip size="small" label={headerChip} color={moduleDisabled ? "warning" : "default"} variant="outlined" sx={{ color: "grey.100", borderColor: "rgba(255,255,255,0.16)" }} />
                        <Switch
                          edge="end"
                          checked={!moduleDisabled}
                          onChange={(_, checked) => {
                            if (checked) enableModule(moduleName); else disableModule(moduleName);
                          }}
                          disabled={loadingModule === moduleName}
                          sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: dashboardAccents.commands } }}
                          slotProps={{ input: { "aria-label": `Enable/disable ${node.module.title} module` } }}
                        />
                      </Box>
                    </Box>
                    <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
                      <Box sx={{ p: 1.5 }}>
                        {node.commands.map(cmd => {
                          const commandDisabled = disabledSet.has(cmd.name);
                          const effectiveDisabled = moduleDisabled || commandDisabled;
                          return (
                            <CommandToggle
                              key={cmd.name}
                              name={cmd.name}
                              displayName={toTitleCase(cmd.name)}
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
            </Stack>
          </FeaturePanel>
        </FeatureShell>
      )}
    </DashboardLayout>
  );
}
