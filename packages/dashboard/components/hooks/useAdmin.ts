"use client";
import React, { useMemo } from "react";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { Work, BugReport, Build, OndemandVideo, SportsEsports, History, MonitorHeart, NotificationsActive } from "@mui/icons-material";

export interface AdminCrumb {
    label: string;
    href: string;
    icon?: React.ReactNode;
}

/**
 * useAdminAccess wraps useDashboardData to provide a stable surface
 * for admin-only views. It returns loading/isAdmin/error for gating.
 */
export function useAdminAccess() {
    const { isAdmin, loading, error } = useDashboardData();
    return { isAdmin, loading, error } as const;
}

/**
 * Builds a breadcrumb trail for admin pages. Always starts with the Admin hub.
 * Pass additional crumbs for deeper pages.
 */
export function useAdminBreadcrumbs(extra: AdminCrumb[] = []) {
    return useMemo(() => {
        const base: AdminCrumb[] = [{ label: "Admin", href: "/dashboard/admin" }];
        return [...base, ...extra];
    }, [extra]);
}

/**
 * Shared metadata for Admin hub cards.
 */
export interface AdminCard {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
}

export function useAdminCards(): AdminCard[] {
    return useMemo(() => ([
        { title: "Jobs", description: "Run scheduled jobs and check status", href: "/dashboard/admin/jobs", icon: React.createElement(Work) },
        { title: "TikTok Debug", description: "Verify usernames and inspect endpoint diagnostics", href: "/dashboard/admin/tiktok", icon: React.createElement(BugReport) },
        { title: "Twitch Debug", description: "Verify Twitch usernames via Helix", href: "/dashboard/admin/twitch", icon: React.createElement(Build) },
        { title: "YouTube Debug", description: "Resolve channel identifiers (handle/username/UC-Id)", href: "/dashboard/admin/youtube", icon: React.createElement(OndemandVideo) },
        { title: "Riot Links", description: "Audit, edit, and remove linked Riot accounts", href: "/dashboard/admin/riot-links", icon: React.createElement(SportsEsports) },
        { title: "Integration Health", description: "See failing notification integrations across servers", href: "/dashboard/admin/integration-health", icon: React.createElement(MonitorHeart) },
        { title: "Notifications", description: "Review recent provider delivery and dedupe records", href: "/dashboard/admin/notifications", icon: React.createElement(NotificationsActive) },
        { title: "Audit Events", description: "Review recent admin and configuration changes", href: "/dashboard/admin/audit", icon: React.createElement(History) },
    ]), []);
}
