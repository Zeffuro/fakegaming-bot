import React from "react";
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  Avatar
} from "@mui/material";
import { Home } from "@mui/icons-material";
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
            sx={{ width: 16, height: 16 }}
          />
        ) : (
          <Avatar sx={{ width: 16, height: 16, fontSize: 10, bgcolor: 'grey.600' }}>
            {guild.name?.charAt(0)}
          </Avatar>
        )
      });

      if (Array.isArray(currentTrail) && currentTrail.length > 0) {
        // Use explicit multi-level trail when provided
        for (const item of currentTrail) {
          breadcrumbs.push({ label: item.label, href: item.href ?? null, icon: item.icon });
        }
      } else if (currentModule) {
        // Back-compat: single module breadcrumb
        breadcrumbs.push({
          label: currentModule.charAt(0).toUpperCase() + currentModule.slice(1),
          href: null
        });
      }
    }

    return breadcrumbs;
  };

  return (
    <Breadcrumbs separator="›" sx={{ ml: 2 }}>
      {getBreadcrumbs().map((crumb, index) => (
        <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {crumb.icon}
          {crumb.href ? (
            <Link
              component="button"
              variant="body2"
              onClick={() => router.push(crumb.href!)}
              sx={{
                textDecoration: "none",
                color: "grey.300",
                '&:hover': { color: "primary.light" }
              }}
            >
              {crumb.label}
            </Link>
          ) : (
            <Typography variant="body2" sx={{ color: "grey.400" }}>
              {crumb.label}
            </Typography>
          )}
        </Box>
      ))}
    </Breadcrumbs>
  );
}
