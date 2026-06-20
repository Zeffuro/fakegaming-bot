"use client";

import { Alert } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";

export function GuildAccessError() {
  return (
    <DashboardLayout>
      <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>
        Guild not found or you don't have access to this guild.
      </Alert>
    </DashboardLayout>
  );
}
