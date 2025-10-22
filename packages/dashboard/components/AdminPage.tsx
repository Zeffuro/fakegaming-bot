"use client";
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Alert, Box, Typography } from "@mui/material";
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

/**
 * AdminPage wraps admin-only pages with a standard layout, access gating,
 * and consistent breadcrumb trail starting at Dashboard > Admin.
 */
export function AdminPage({ title, trail = [], children }: AdminPageProps) {
    const { loading, isAdmin, error } = useAdminAccess();
    const currentTrail = useAdminBreadcrumbs(trail);

    if (error) {
        return (
            <DashboardLayout>
                <Alert severity="error">{error}</Alert>
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
        <DashboardLayout loading={loading} currentTrail={currentTrail}>
            {!loading && (
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>{title}</Typography>
                    {children}
                </Box>
            )}
        </DashboardLayout>
    );
}

