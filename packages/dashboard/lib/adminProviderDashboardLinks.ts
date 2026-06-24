import type { IntegrationHealthRecord } from "@/lib/api-client";

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

export function getAdminProviderDashboardLinks(
    record: Pick<IntegrationHealthRecord, "provider" | "guildId">,
): AdminProviderDashboardLink[] {
    const guildId = record.guildId?.trim();
    if (!guildId) return [];

    const encodedGuildId = encodeURIComponent(guildId);
    const providerKey = normalizeProviderDashboardKey(record.provider);
    const providerPath = providerDashboardPaths[providerKey];
    const links: AdminProviderDashboardLink[] = [];

    if (providerPath) {
        links.push({
            id: "provider",
            label: "Provider page",
            href: `/dashboard/${providerPath}/${encodedGuildId}`,
            kind: "provider",
        });
    }

    links.push(
        {
            id: "guild",
            label: "Server overview",
            href: `/dashboard/${encodedGuildId}`,
            kind: "guild",
        },
        {
            id: "notifications",
            label: "Notification setup",
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
