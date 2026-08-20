"use client";
import React, { useMemo } from "react";
import { useDashboardData } from "@/components/hooks/useDashboardData";
import { Work, BugReport, Build, OndemandVideo, SportsEsports, History, MonitorHeart, NotificationsActive } from "@mui/icons-material";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

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
    const { t } = useDashboardI18n();
    return useMemo(() => {
        const base: AdminCrumb[] = [{ label: t("admin.eyebrow"), href: "/dashboard/admin" }];
        return [...base, ...extra];
    }, [extra, t]);
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
    const { t } = useDashboardI18n();
    return useMemo(() => ([
        { title: t("admin.jobs"), description: t("admin.jobsDescription"), href: "/dashboard/admin/jobs", icon: React.createElement(Work) },
        { title: t("admin.tiktokDebug"), description: t("admin.tiktokDebugDescription"), href: "/dashboard/admin/tiktok", icon: React.createElement(BugReport) },
        { title: t("admin.twitchDebug"), description: t("admin.twitchDebugDescription"), href: "/dashboard/admin/twitch", icon: React.createElement(Build) },
        { title: t("admin.youtubeDebug"), description: t("admin.youtubeDebugDescription"), href: "/dashboard/admin/youtube", icon: React.createElement(OndemandVideo) },
        { title: t("admin.riotLinks"), description: t("admin.riotLinksDescription"), href: "/dashboard/admin/riot-links", icon: React.createElement(SportsEsports) },
        { title: t("admin.integrationHealth"), description: t("admin.integrationHealthDescription"), href: "/dashboard/admin/integration-health", icon: React.createElement(MonitorHeart) },
        { title: t("admin.notifications"), description: t("admin.notificationsDescription"), href: "/dashboard/admin/notifications", icon: React.createElement(NotificationsActive) },
        { title: t("admin.auditEvents"), description: t("admin.auditEventsDescription"), href: "/dashboard/admin/audit", icon: React.createElement(History) },
    ]), [t]);
}
