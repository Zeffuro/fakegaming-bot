"use client";

import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { FeaturePanel } from "@/components/dashboard/FeaturePanel";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";

interface FeatureHeroStat {
  label: string;
  value: string | number;
}

interface FeatureHeroProps {
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: React.ReactNode;
  accent?: string;
  secondaryAccent?: string;
  stats?: FeatureHeroStat[];
  actions?: React.ReactNode;
  nav?: React.ReactNode;
}

export function FeatureHero({
  icon,
  eyebrow,
  title,
  description,
  accent = dashboardAccents.neutral,
  secondaryAccent = accent,
  stats,
  actions,
  nav,
}: FeatureHeroProps) {
  return (
    <FeaturePanel
      accent={accent}
      sx={{
        p: { xs: 2.5, md: 3.5 },
        mb: 3,
        background: `linear-gradient(135deg, ${alpha(accent, 0.22)}, rgba(18,24,34,0.96) 44%, ${alpha(secondaryAccent, 0.14)})`,
      }}
    >
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} sx={{ justifyContent: "space-between", position: "relative" }}>
        <Stack spacing={1.5} sx={{ maxWidth: 780 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            {eyebrow && (
              <Chip
                icon={React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ fontSize?: "small" }>, { fontSize: "small" }) : undefined}
                label={eyebrow}
                sx={{ bgcolor: alpha(accent, 0.14), color: "grey.50", border: `1px solid ${alpha(accent, 0.42)}` }}
              />
            )}
            {stats?.map((stat) => (
              <Chip
                key={stat.label}
                label={`${stat.value} ${stat.label}`}
                sx={{ bgcolor: "rgba(255,255,255,0.07)", color: "grey.100" }}
              />
            ))}
          </Stack>
          <Typography variant="h3" sx={{ color: "grey.50", fontWeight: 900, letterSpacing: "-0.04em" }}>
            {title}
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: { xs: 15, md: 17 }, maxWidth: 700 }}>
            {description}
          </Typography>
        </Stack>

        {(actions || nav) && (
          <Stack spacing={1.5} sx={{ alignItems: { xs: "stretch", lg: "flex-end" }, minWidth: { lg: 360 } }}>
            {actions}
            {nav}
          </Stack>
        )}
      </Stack>
      <Box
        sx={{
          position: "absolute",
          right: -70,
          bottom: -92,
          width: 230,
          height: 230,
          borderRadius: "999px",
          background: `radial-gradient(circle, ${alpha(secondaryAccent, 0.22)}, transparent 66%)`,
          pointerEvents: "none",
        }}
      />
    </FeaturePanel>
  );
}
