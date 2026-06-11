import React from "react";
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import BreadcrumbsNavigation from "./BreadcrumbsNavigation";
import UserMenu from "./UserMenu";
import LoadingSkeleton from "./LoadingSkeleton";

interface BreadcrumbItem {
  label: string;
  href: string | null;
  icon?: React.ReactNode;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  guild?: any;
  currentModule?: string | null;
  currentTrail?: BreadcrumbItem[] | null;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}

export default function DashboardLayout({
  children,
  guild,
  currentModule,
  currentTrail,
  maxWidth = "xl",
  loading = false
}: DashboardLayoutProps) {
  const router = useRouter();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#070B12",
        background:
          "radial-gradient(circle at 18% -8%, rgba(104,215,255,0.12), transparent 34%), radial-gradient(circle at 82% 0%, rgba(255,107,154,0.08), transparent 28%), linear-gradient(180deg, #0B111C 0%, #070B12 48%, #05070B 100%)",
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(7,11,18,0.82)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(18px)",
          background:
            "linear-gradient(90deg, rgba(104,215,255,0.08), rgba(12,18,29,0.88) 32%, rgba(255,107,154,0.07))",
          boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", gap: 2, minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, md: 2 }, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2.2,
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                  color: "grey.50",
                  fontWeight: 950,
                  letterSpacing: "-0.06em",
                  background: "linear-gradient(135deg, #68D7FF, #FF6B9A)",
                  boxShadow: `0 14px 34px ${alpha("#68D7FF", 0.22)}`,
                }}
              >
                FG
              </Box>
              <Box sx={{ minWidth: 0, display: { xs: "none", sm: "block" } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "grey.50", letterSpacing: "-0.035em", lineHeight: 1 }}>
                  Fakegaming Bot
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.46)", fontWeight: 650 }}>
                  Control panel
                </Typography>
              </Box>
            </Box>

            <BreadcrumbsNavigation guild={guild} currentModule={currentModule} currentTrail={currentTrail} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, md: 1.4 }, flex: "0 0 auto" }}>
            {guild && (
              <Button
                startIcon={<ArrowBack />}
                onClick={() => router.push("/dashboard")}
                variant="outlined"
                size="small"
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  borderColor: "rgba(255,255,255,0.16)",
                  color: "grey.200",
                  borderRadius: 999,
                  textTransform: "none",
                  fontWeight: 750,
                  bgcolor: "rgba(255,255,255,0.035)",
                  '&:hover': {
                    borderColor: "rgba(255,255,255,0.32)",
                    bgcolor: "rgba(255,255,255,0.08)"
                  }
                }}
              >
                Back to Guilds
              </Button>
            )}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth={maxWidth} sx={{ py: { xs: 3, md: 4 } }}>
        {loading ? <LoadingSkeleton /> : children}
      </Container>
    </Box>
  );
}
