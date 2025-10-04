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
import { useRouter } from "next/navigation";
import BreadcrumbsNavigation from "./BreadcrumbsNavigation";
import UserMenu from "./UserMenu";
import LoadingSkeleton from "./LoadingSkeleton";

interface DashboardLayoutProps {
  children: React.ReactNode;
  guild?: any;
  currentModule?: string | null;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  loading?: boolean;
}

export default function DashboardLayout({
  children,
  guild,
  currentModule,
  maxWidth = "xl",
  loading = false
}: DashboardLayoutProps) {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.900" }}>
      {/* Dark Mode App Bar */}
      <AppBar position="sticky" elevation={0} sx={{
        bgcolor: "grey.800",
        borderBottom: 1,
        borderColor: "grey.700"
      }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.light" }}>
              Fakegaming Bot
            </Typography>

            <BreadcrumbsNavigation guild={guild} currentModule={currentModule} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {guild && (
              <Button
                startIcon={<ArrowBack />}
                onClick={() => router.push("/dashboard")}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: "grey.600",
                  color: "grey.300",
                  '&:hover': {
                    borderColor: "grey.500",
                    bgcolor: "grey.700"
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

      {/* Dark Mode Main Content */}
      <Container maxWidth={maxWidth} sx={{ py: 4 }}>
        {loading ? <LoadingSkeleton /> : children}
      </Container>
    </Box>
  );
}
