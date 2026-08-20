import type { NotificationChannelLoad, NotificationReviewGroup } from "@/lib/notificationSetupReview";
import type { NotificationConfigStatusFilter } from "@/lib/notificationConfigFilters";
import { getDashboardLocaleValue, type DashboardLocale } from "@/lib/i18n/localeStore";

export interface NotificationSetupLink {
    label: string;
    href: string;
}

const providerRoutes = new Map([
    ["Twitch", "twitch"],
    ["YouTube", "youtube"],
    ["TikTok", "tiktok"],
    ["Bluesky", "bluesky"],
    ["Steam News", "steam-news"],
    ["Patch Notes", "patch-notes"],
]);

export function buildNotificationProviderFilterHref(
    guildId: string,
    provider: string,
    query: string,
    status: NotificationConfigStatusFilter = "all"
): string | null {
    const route = providerRoutes.get(provider);
    if (!route) return null;

    const params = new URLSearchParams();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 0) {
        params.set("q", trimmedQuery);
    }
    if (status !== "all") {
        params.set("status", status);
    }

    const queryString = params.toString();
    return `/dashboard/${route}/${encodeURIComponent(guildId)}${queryString ? `?${queryString}` : ""}`;
}

export function buildNotificationReviewGroupLink(
    guildId: string,
    group: Pick<NotificationReviewGroup, "provider" | "sourceLabel">,
    locale: DashboardLocale = "en",
): NotificationSetupLink | null {
    const href = buildNotificationProviderFilterHref(guildId, group.provider, group.sourceLabel);
    return href ? {
        label: getDashboardLocaleValue(locale, {
            en: `Open ${group.provider}`,
            nl: `${group.provider} openen`,
        }),
        href,
    } : null;
}

export function buildNotificationChannelLinks(
    guildId: string,
    channel: Pick<NotificationChannelLoad, "channelId" | "providers">,
    _locale: DashboardLocale = "en",
): NotificationSetupLink[] {
    return channel.providers
        .map((provider) => {
            const href = buildNotificationProviderFilterHref(guildId, provider, channel.channelId);
            return href ? { label: provider, href } : null;
        })
        .filter((link): link is NotificationSetupLink => link !== null);
}
