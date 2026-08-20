"use client";

import React from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export default function AdminHubPage() {
    const { t } = useDashboardI18n();
    return (
        <AdminPage title={t("nav.adminPanel")}>
            <AdminOverview />
        </AdminPage>
    );
}
