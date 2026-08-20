"use client";

import { Alert } from "@mui/material";
import DashboardLayout from "@/components/DashboardLayout";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export function GuildAccessError() {
  const { t } = useDashboardI18n();
  return (
    <DashboardLayout>
      <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>
        {t("guild.notFoundOrForbidden")}
      </Alert>
    </DashboardLayout>
  );
}
