import React from "react";
import { Box, Button, Card, CardActions, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Delete, Edit } from "@mui/icons-material";
import { dashboardAccents, dashboardCardSx, dangerActionButtonSx, ghostActionButtonSx } from "@/components/dashboard/dashboardTheme";

interface ConfigCardProps {
  title: string;
  accent?: string;
  channelInfo: {
    label: string;
    value: string;
  };
  discordChannel: string;
  customMessage?: string;
  statusChip?: {
    label: string;
    color?: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
    variant?: "filled" | "outlined";
  };
  onEdit: () => void;
  onDelete: () => void;
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
  onEdit,
  onDelete,
  saving = false,
  showEdit = true,
}: ConfigCardProps) {
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
            {statusChip && (
              <Chip
                label={statusChip.label}
                size="small"
                color={statusChip.color || "default"}
                variant={statusChip.variant || "outlined"}
              />
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
          </Box>
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2, pt: 0, mt: "auto" }}>
        {showEdit ? (
          <Button size="small" variant="outlined" startIcon={<Edit />} onClick={onEdit} sx={ghostActionButtonSx(accent)}>
            Edit
          </Button>
        ) : <Box />}
        <IconButton color="error" size="small" onClick={onDelete} disabled={saving} sx={dangerActionButtonSx}>
          <Delete />
        </IconButton>
      </CardActions>
    </Card>
  );
}
