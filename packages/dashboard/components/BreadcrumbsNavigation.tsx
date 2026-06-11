import React from "react";
import {
  Avatar,
  Box,
  Breadcrumbs,
  Link,
  Typography
} from "@mui/material";
import { Home } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href: string | null;
  icon?: React.ReactNode;
}

interface BreadcrumbsNavigationProps {
  guild?: any;
  currentModule?: string | null;
  currentTrail?: BreadcrumbItem[] | null;
}

export default function BreadcrumbsNavigation({ guild, currentModule, currentTrail }: BreadcrumbsNavigationProps) {
  const router = useRouter();

  const getBreadcrumbs = () => {
    const breadcrumbs: BreadcrumbItem[] = [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <Home sx={{ fontSize: 16 }} />
      }
    ];

    if (guild) {
      breadcrumbs.push({
        label: guild.name,
        href: `/dashboard/${guild.id}`,
        icon: guild.icon ? (
          <Avatar
            src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
            sx={{ width: 18, height: 18, border: "1px solid rgba(255,255,255,0.18)" }}
          />
        ) : (
          <Avatar sx={{ width: 18, height: 18, fontSize: 10, bgcolor: "rgba(255,255,255,0.12)", color: "grey.50" }}>
            {guild.name?.charAt(0)}
          </Avatar>
        )
      });

      if (Array.isArray(currentTrail) && currentTrail.length > 0) {
        for (const item of currentTrail) {
          breadcrumbs.push({ label: item.label, href: item.href ?? null, icon: item.icon });
        }
      } else if (currentModule) {
        breadcrumbs.push({
          label: currentModule.charAt(0).toUpperCase() + currentModule.slice(1),
          href: null
        });
      }
      return breadcrumbs;
    }

    if (Array.isArray(currentTrail) && currentTrail.length > 0) {
      for (const item of currentTrail) {
        breadcrumbs.push({ label: item.label, href: item.href ?? null, icon: item.icon });
      }
    }

    return breadcrumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  return (
    <Box
      sx={{
        minWidth: 0,
        display: { xs: "none", md: "block" },
        borderRadius: 999,
        px: 1.35,
        py: 0.65,
        bgcolor: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.05)}`,
      }}
    >
      <Breadcrumbs
        separator={<Box component="span" sx={{ color: "rgba(255,255,255,0.26)", mx: 0.25 }}>/</Box>}
        sx={{
          minWidth: 0,
          "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap", minWidth: 0 },
          "& .MuiBreadcrumbs-li": { minWidth: 0 },
        }}
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <Box key={`${crumb.label}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0, maxWidth: isLast ? 260 : 180 }}>
              <Box sx={{ display: "grid", placeItems: "center", color: isLast ? "grey.100" : "rgba(255,255,255,0.58)", flex: "0 0 auto" }}>
                {crumb.icon}
              </Box>
              {crumb.href ? (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => router.push(crumb.href!)}
                  sx={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    color: "rgba(255,255,255,0.66)",
                    fontWeight: 700,
                    '&:hover': { color: "#68D7FF" }
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <Typography variant="body2" sx={{ color: "grey.100", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {crumb.label}
                </Typography>
              )}
            </Box>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
