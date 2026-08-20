"use client";
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert } from "@mui/material";
import { AdminPanelSettings } from "@mui/icons-material";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { useAdminAccess, useAdminBreadcrumbs } from "@/components/hooks/useAdmin";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

export interface AdminBreadcrumbItem {
    label: string;
    href: string;
    icon?: React.ReactNode;
}

export interface AdminPageProps {
    title: string;
    trail?: AdminBreadcrumbItem[];
    children: React.ReactNode;
}

export function AdminPage({ title, trail = [], children }: AdminPageProps) {
    const { t } = useDashboardI18n();
    const { loading, isAdmin, error } = useAdminAccess();
    const currentTrail = useAdminBreadcrumbs(trail);

    if (error) {
        return (
            <DashboardLayout>
                <Alert severity="error" sx={{ bgcolor: "error.dark", color: "error.light" }}>{error}</Alert>
            </DashboardLayout>
        );
    }

    if (!loading && !isAdmin) {
        return (
            <DashboardLayout>
                <Alert severity="warning">{t("admin.noAccess")}</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout loading={loading} currentTrail={currentTrail} maxWidth="xl">
            {!loading && (
                <FeatureShell accent={dashboardAccents.admin} secondaryAccent={dashboardAccents.patchNotes}>
                    <FeatureHero
                        icon={<AdminPanelSettings />}
                        eyebrow={t("admin.eyebrow")}
                        title={title}
                        description={t("admin.description")}
                        accent={dashboardAccents.admin}
                        secondaryAccent={dashboardAccents.patchNotes}
                    />
                    {children}
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}
