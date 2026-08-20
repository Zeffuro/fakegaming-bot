import type { IntegrationHealthRecord } from "@/lib/api-client";
import { getDashboardLocaleValue, type DashboardLocale, type DashboardLocaleValues } from "@/lib/i18n/localeStore";

export type AdminProviderDashboardLinkKind = "provider" | "guild" | "notifications";

export interface AdminProviderDashboardLink {
    id: string;
    label: string;
    href: string;
    kind: AdminProviderDashboardLinkKind;
}

const providerDashboardPaths: Record<string, string> = {
    anime: "anime",
    birthday: "birthdays",
    bluesky: "bluesky",
    patchnotes: "patch-notes",
    steamnews: "steam-news",
    tiktok: "tiktok",
    twitch: "twitch",
    youtube: "youtube",
};

const linkLabels = {
    en: {
        provider: "Provider page",
        guild: "Server overview",
        notifications: "Notification setup",
    },
    nl: {
        provider: "Providerpagina",
        guild: "Serveroverzicht",
        notifications: "Meldingsinstellingen",
    },
} satisfies DashboardLocaleValues<Record<AdminProviderDashboardLinkKind, string>>;

export function getAdminProviderDashboardLinks(
    record: Pick<IntegrationHealthRecord, "provider" | "guildId">,
    locale: DashboardLocale = "en",
): AdminProviderDashboardLink[] {
    const guildId = record.guildId?.trim();
    if (!guildId) return [];

    const encodedGuildId = encodeURIComponent(guildId);
    const providerKey = normalizeProviderDashboardKey(record.provider);
    const providerPath = providerDashboardPaths[providerKey];
    const links: AdminProviderDashboardLink[] = [];
    const labels = getDashboardLocaleValue(locale, linkLabels);

    if (providerPath) {
        links.push({
            id: "provider",
            label: labels.provider,
            href: `/dashboard/${providerPath}/${encodedGuildId}`,
            kind: "provider",
        });
    }

    links.push(
        {
            id: "guild",
            label: labels.guild,
            href: `/dashboard/${encodedGuildId}`,
            kind: "guild",
        },
        {
            id: "notifications",
            label: labels.notifications,
            href: `/dashboard/settings/${encodedGuildId}/notifications`,
            kind: "notifications",
        },
    );

    return links;
}

export function normalizeProviderDashboardKey(provider: string): string {
    const normalized = provider.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "birthdays") return "birthday";
    if (normalized === "patchnote") return "patchnotes";
    return normalized;
}
