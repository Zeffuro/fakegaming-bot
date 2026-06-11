"use client";

import React from "react";
import { Paper, type SxProps, type Theme } from "@mui/material";
import { dashboardPanelSx } from "@/components/dashboard/dashboardTheme";

interface FeaturePanelProps {
  accent?: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function FeaturePanel({ accent, children, sx }: FeaturePanelProps) {
  return (
    <Paper sx={{ ...dashboardPanelSx(accent), p: 3, ...(sx as Record<string, unknown> | undefined) }}>
      {children}
    </Paper>
  );
}
