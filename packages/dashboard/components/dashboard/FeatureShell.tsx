"use client";

import React from "react";
import { Box, type SxProps, type Theme } from "@mui/material";
import { dashboardShellSx } from "@/components/dashboard/dashboardTheme";

interface FeatureShellProps {
  accent?: string;
  secondaryAccent?: string;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function FeatureShell({ accent, secondaryAccent, children, sx }: FeatureShellProps) {
  return (
    <Box sx={{ ...dashboardShellSx(accent, secondaryAccent), ...(sx as Record<string, unknown> | undefined) }}>
      {children}
    </Box>
  );
}
