import React from "react";
import { Box, Button, Card, CardActions, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Delete, Edit, PauseCircleOutlined, PlayCircleOutlined } from "@mui/icons-material";
import { dashboardAccents, dashboardCardSx, dangerActionButtonSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";
import type { ConfigNotificationInfo } from "@/lib/notificationTiming";

export interface ConfigStatusChip {
  label: string;
  color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
  variant?: "filled" | "outlined";
}

export interface ConfigHealthInfo {
  lines: string[];
  error?: string | null;
}

interface ConfigCardProps {
  title: string;
  accent?: string;
  channelInfo: {
    label: string;
    value: string;
  };
  discordChannel: string;
  customMessage?: string;
  statusChip?: ConfigStatusChip;
  extraStatusChips?: ConfigStatusChip[];
  healthInfo?: ConfigHealthInfo;
  notificationInfo?: ConfigNotificationInfo;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaused?: () => void;
  paused?: boolean;
  saving?: boolean;
  showEdit?: boolean;
}

export default function ConfigCard({
  title,
  accent = dashboardAccents.neutral,
  channelInfo,
  discordChannel,
  customMessage,
  statusChip,
  extraStatusChips = [],
  healthInfo,
  notificationInfo,
  onEdit,
  onDelete,
  onTogglePaused,
  paused = false,
  saving = false,
  showEdit = true,
}: ConfigCardProps) {
  const chips = [statusChip, ...extraStatusChips].filter((chip): chip is ConfigStatusChip => Boolean(chip));
  const pauseLabel = paused ? "Resume" : "Pause";
  const PauseIcon = paused ? PlayCircleOutlined : PauseCircleOutlined;

  return (
    <Card sx={{ ...dashboardCardSx(accent), display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flex: 1 }}>
        <Stack spacing={1.35}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 850, color: "grey.50", lineHeight: 1.2 }} noWrap>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha(accent, 0.90), fontWeight: 700 }}>
                {channelInfo.label}: {channelInfo.value}
              </Typography>
            </Box>
            {chips.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ justifyContent: "flex-end", flexWrap: "wrap", rowGap: 0.75 }}>
                {chips.map((chip) => (
                  <Chip
                    key={chip.label}
                    label={chip.label}
                    size="small"
                    color={chip.color || "default"}
                    variant={chip.variant || "outlined"}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", p: 1.25 }}>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.66)" }}>
              Discord channel: <Box component="span" sx={{ color: "grey.100", fontWeight: 700 }}>{discordChannel}</Box>
            </Typography>
            {customMessage && (
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.54)", mt: 0.75 }}>
                Custom message: {customMessage}
              </Typography>
            )}
            {notificationInfo && notificationInfo.lines.map((line) => (
              <Typography key={line} variant="caption" sx={{ color: "rgba(255,255,255,0.54)", display: "block", mt: 0.75 }}>
                {line}
              </Typography>
            ))}
          </Box>

          {healthInfo && (
            <Box sx={{ borderRadius: 2.5, bgcolor: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.06)", p: 1.25 }}>
              {healthInfo.lines.map((line) => (
                <Typography key={line} variant="caption" sx={{ color: "rgba(255,255,255,0.58)", display: "block" }}>
                  {line}
                </Typography>
              ))}
              {healthInfo.error && (
                <Typography variant="caption" sx={{ color: dashboardAccents.quotes, display: "block", mt: 0.5 }}>
                  {healthInfo.error}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2, pt: 0, mt: "auto" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {onTogglePaused && (
            <Button size="small" variant="outlined" startIcon={<PauseIcon />} disabled={saving} onClick={onTogglePaused} sx={ghostActionButtonSx(accent)}>
              {pauseLabel}
            </Button>
          )}
          {showEdit && (
            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={onEdit} sx={ghostActionButtonSx(accent)}>
              Edit
            </Button>
          )}
          {!onTogglePaused && !showEdit && <Box />}
        </Stack>
        <IconButton color="error" size="small" onClick={onDelete} disabled={saving} sx={dangerActionButtonSx}>
          <Delete />
        </IconButton>
      </CardActions>
    </Card>
  );
}
