"use client";
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert } from "@mui/material";
import { AdminPanelSettings } from "@mui/icons-material";
import { FeatureHero } from "@/components/dashboard/FeatureHero";
import { FeatureShell } from "@/components/dashboard/FeatureShell";
import { dashboardAccents } from "@/components/dashboard/dashboardTheme";
import { useAdminAccess, useAdminBreadcrumbs } from "@/components/hooks/useAdmin";

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
                <Alert severity="warning">You do not have access to Admin tools.</Alert>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout loading={loading} currentTrail={currentTrail} maxWidth="xl">
            {!loading && (
                <FeatureShell accent={dashboardAccents.admin} secondaryAccent={dashboardAccents.patchNotes}>
                    <FeatureHero
                        icon={<AdminPanelSettings />}
                        eyebrow="Admin"
                        title={title}
                        description="Operational tools for checking jobs, providers, and backend-only diagnostics."
                        accent={dashboardAccents.admin}
                        secondaryAccent={dashboardAccents.patchNotes}
                    />
                    {children}
                </FeatureShell>
            )}
        </DashboardLayout>
    );
}
