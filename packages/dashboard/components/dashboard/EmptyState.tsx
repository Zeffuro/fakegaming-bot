"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  accent?: string;
}

export function EmptyState({ icon, title, description, accent = dashboardAccents.neutral }: EmptyStateProps) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 5,
        px: 2,
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {icon && (
        <Box sx={{ color: accent, mb: 1.5, "& svg": { fontSize: 58, filter: `drop-shadow(0 10px 24px ${alpha(accent, 0.18)})` } }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: 0.75, color: "grey.100", fontWeight: 800 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.52)", maxWidth: 460, mx: "auto" }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}
