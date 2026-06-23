"use client";

import React from "react";
import Link from "next/link";
import { Avatar, Box, Button, Card, CardActions, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { dashboardAccents, dashboardCardSx, primaryActionButtonSx } from "@/components/dashboard/dashboardTheme";

interface FeatureCardProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
  href?: string;
  chipLabel?: string;
  statusLabel?: string;
  meta?: React.ReactNode;
  actionLabel?: string;
}

export function FeatureCard({
  title,
  description,
  icon,
  accent = dashboardAccents.neutral,
  href,
  chipLabel,
  statusLabel,
  meta,
  actionLabel = "Open",
}: FeatureCardProps) {
  return (
    <Card sx={{ ...dashboardCardSx(accent), display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ pb: 1.5, flex: 1 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Avatar sx={{ bgcolor: alpha(accent, 0.18), color: accent, border: `1px solid ${alpha(accent, 0.34)}` }}>
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" sx={{ color: "grey.50", fontWeight: 850, lineHeight: 1.15 }}>
                {title}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: "wrap", rowGap: 0.75 }}>
                {statusLabel && (
                  <Chip size="small" label={statusLabel} sx={{ bgcolor: alpha(accent, 0.12), color: "grey.100", border: `1px solid ${alpha(accent, 0.20)}` }} />
                )}
                {chipLabel && (
                  <Chip size="small" label={chipLabel} sx={{ bgcolor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.76)" }} />
                )}
              </Stack>
            </Box>
          </Stack>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.62)" }}>
            {description}
          </Typography>
          {meta && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.44)" }}>
              {meta}
            </Typography>
          )}
        </Stack>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, mt: "auto" }}>
        <Button
          component={href ? Link : "button"}
          href={href}
          fullWidth
          variant="contained"
          sx={primaryActionButtonSx(accent)}
        >
          {actionLabel}
        </Button>
      </CardActions>
    </Card>
  );
}
