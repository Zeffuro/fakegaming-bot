"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Collapse, Divider, IconButton, InputAdornment, Stack, Switch, TextField, Typography } from "@mui/material";
import { Block, ExpandLess, ExpandMore, Search } from "@mui/icons-material";
import DashboardLayout from "@/components/DashboardLayout";
import CommandToggle from "@/components/Commands/CommandToggle";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { GuildAccessError } from "@/components/GuildAccessError";
import { dashboardAccents, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import { useGuildCommands } from "@/components/hooks/useGuildCommands";
import { useGuildFromParams } from "@/components/hooks/useGuildFromParams";
import { useGuildModules } from "@/components/hooks/useGuildModules";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";
import { BOT_TREE, getLocalizedBotCommand } from "@/lib/commands";
import type { DashboardMessageKey } from "@/lib/i18n/messages";

const moduleCopyKeys: Record<string, { title: DashboardMessageKey; description: DashboardMessageKey }> = {
  anime: { title: "commands.module.anime.title", description: "commands.module.anime.description" },
  birthdays: { title: "commands.module.birthdays.title", description: "commands.module.birthdays.description" },
  bluesky: { title: "commands.module.bluesky.title", description: "commands.module.bluesky.description" },
  "game-night": { title: "commands.module.gameNight.title", description: "commands.module.gameNight.description" },
  general: { title: "commands.module.general.title", description: "commands.module.general.description" },
  league: { title: "commands.module.league.title", description: "commands.module.league.description" },
  notes: { title: "commands.module.notes.title", description: "commands.module.notes.description" },
  patchnotes: { title: "commands.module.patchnotes.title", description: "commands.module.patchnotes.description" },
  quotes: { title: "commands.module.quotes.title", description: "commands.module.quotes.description" },
  reminders: { title: "commands.module.reminders.title", description: "commands.module.reminders.description" },
  shared: { title: "commands.module.shared.title", description: "commands.module.shared.description" },
  steam: { title: "commands.module.steam.title", description: "commands.module.steam.description" },
  tiktok: { title: "commands.module.tiktok.title", description: "commands.module.tiktok.description" },
  twitch: { title: "commands.module.twitch.title", description: "commands.module.twitch.description" },
  youtube: { title: "commands.module.youtube.title", description: "commands.module.youtube.description" },
};

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function GuildCommandsPage() {
  const { locale, t } = useDashboardI18n();
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
  const localizedTree = useMemo(() => BOT_TREE.map(node => {
    const moduleKeys = moduleCopyKeys[node.module.name];
    return {
      ...node,
      module: {
        ...node.module,
        localizedTitle: moduleKeys ? t(moduleKeys.title) : node.module.title,
        localizedDescription: moduleKeys ? t(moduleKeys.description) : node.module.description,
      },
      commands: node.commands.map(command => {
        const localized = getLocalizedBotCommand(command, locale);
        return {
          ...command,
          localizedName: localized.name,
          localizedDescription: localized.description,
        };
      }),
    };
  }), [locale, t]);
  const totalCommands = localizedTree.reduce((sum, node) => sum + node.commands.length, 0);
  const enabledCommands = totalCommands - disabledCommands.length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTree = useMemo(() => {
    if (!normalizedSearch) return localizedTree;
    return localizedTree.map(node => {
      const moduleMatches = [
        node.module.name,
        node.module.title,
        node.module.description,
        node.module.localizedTitle,
        node.module.localizedDescription,
      ].some(value => value.toLowerCase().includes(normalizedSearch));
      const commands = moduleMatches
        ? node.commands
        : node.commands.filter(command => [
          command.name,
          toTitleCase(command.name),
          command.description,
          command.localizedName,
          command.localizedDescription,
        ].some(value => value.toLowerCase().includes(normalizedSearch)));
      return { ...node, commands };
    }).filter(node => node.commands.length > 0);
  }, [localizedTree, normalizedSearch]);
  const filteredCommandCount = filteredTree.reduce((sum, node) => sum + node.commands.length, 0);

  if (!guild && !guildsLoading) {
    return <GuildAccessError />;
  }

  return (
    <DashboardLayout guild={guild} currentModule="commands" maxWidth="xl" loading={guildsLoading}>
      {guild && (
        <FeatureShell accent={dashboardAccents.commands} secondaryAccent={dashboardAccents.settings}>
          <FeatureHero
            icon={<Block />}
            eyebrow={t("commands.eyebrow")}
            title={t("commands.title")}
            description={t("commands.description")}
            accent={dashboardAccents.commands}
            secondaryAccent={dashboardAccents.settings}
            stats={[
              { label: t("commands.enabled"), value: `${enabledCommands}/${totalCommands}` },
              { label: t("commands.modulesDisabled"), value: disabledModules.length },
            ]}
            actions={(
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-start", lg: "flex-end" }, rowGap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => setAll(false)} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t("commands.expandAll")}</Button>
                <Button size="small" variant="outlined" onClick={() => setAll(true)} sx={ghostActionButtonSx(dashboardAccents.commands)}>{t("commands.collapseAll")}</Button>
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
                placeholder={t("commands.search")}
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
                  {t(filteredCommandCount === 1 ? "commands.showingOne" : "commands.showingMany", { count: filteredCommandCount })}
                </Typography>
              )}
              {filteredTree.length === 0 && (
                <Alert severity="info" sx={{ bgcolor: "rgba(104,215,255,0.10)", color: "grey.100", border: "1px solid rgba(104,215,255,0.20)" }}>
                  {t("commands.noMatch")}
                </Alert>
              )}
              {filteredTree.map((node) => {
                const moduleName = node.module.name;
                const moduleDisabled = disabledModules.includes(moduleName);
                const isCollapsed = !!collapsed[moduleName];
                if (node.commands.length === 0) return null;

                const total = node.commands.length;
                const enabledCount = moduleDisabled ? 0 : node.commands.filter(c => !disabledSet.has(c.name)).length;
                const moduleTitle = node.module.localizedTitle;
                const headerChip = moduleDisabled
                  ? t("commands.moduleDisabled")
                  : t("commands.enabledCount", { enabled: enabledCount, total });

                return (
                  <Box key={moduleName} sx={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 3, bgcolor: "rgba(8,13,22,0.72)", overflow: "hidden" }}>
                    <Box sx={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 2, p: 2, flexWrap: { xs: "wrap", md: "nowrap" } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
                        <IconButton size="small" onClick={() => toggleCollapsed(moduleName)} aria-label={t(isCollapsed ? "commands.expandModule" : "commands.collapseModule", { module: moduleTitle })} sx={ghostActionButtonSx(dashboardAccents.commands)}>
                          {isCollapsed ? <ExpandMore /> : <ExpandLess />}
                        </IconButton>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50" }}>
                            {moduleTitle}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)" }}>
                            {node.module.localizedDescription}
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
                          slotProps={{ input: { "aria-label": t("commands.toggleModule", { module: moduleTitle }) } }}
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
                              displayName={toTitleCase(cmd.localizedName)}
                              description={cmd.localizedDescription}
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
