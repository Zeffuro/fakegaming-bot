import type { AnimeSearchResult, AnimeSubscriptionDashboardConfig } from "@/lib/api-client";

const airingDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatAnimeTitle(anime: AnimeSearchResult): string {
  return anime.title.english || anime.title.romaji || anime.title.native || `AniList #${anime.id}`;
}

export function formatStatus(status?: string | null): string {
  return status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown";
}

export function formatAnimeMeta(anime: AnimeSearchResult): string {
  return [
    anime.seasonYear ?? "Unknown Year",
    anime.format?.replace(/_/g, " ") ?? "ANIME",
    formatStatus(anime.status),
    anime.episodes ? `${anime.episodes} Episodes` : null,
    anime.averageScore ? `${anime.averageScore}/100` : null,
  ].filter(Boolean).join(" - ");
}

export function formatAiring(ms?: number | null): string {
  if (!ms) return "No upcoming episode known";
  return airingDateFormatter.format(new Date(ms));
}

export function formatNextEpisode(anime: AnimeSearchResult): string | null {
  if (!anime.nextAiringEpisode) return null;
  return `Episode ${anime.nextAiringEpisode.episode} Airs ${formatAiring(anime.nextAiringEpisode.airingAt * 1000)}`;
}

export function canSubscribe(anime?: Pick<AnimeSearchResult, "status"> | null): boolean {
  return Boolean(anime && anime.status !== "FINISHED" && anime.status !== "CANCELLED");
}

export function subscriptionTitle(config: AnimeSubscriptionDashboardConfig): string {
  return config.animeTitle || `AniList #${config.anilistId}`;
}

export function subscriptionMeta(config: AnimeSubscriptionDashboardConfig): string {
  return [
    config.format?.replace(/_/g, " ") ?? null,
    config.status ? formatStatus(config.status) : null,
    config.nextEpisode && config.nextAiringAt ? `Episode ${config.nextEpisode} ${formatAiring(Number(config.nextAiringAt))}` : null,
    `${config.reminderMinutes ?? 30} Min Reminder`,
  ].filter(Boolean).join(" - ");
}

export function getSubscribeHint(args: { anime?: AnimeSearchResult | null; channelId?: string; saving?: boolean }): string {
  if (args.saving) return "Saving...";
  if (args.anime && !canSubscribe(args.anime)) return `${formatStatus(args.anime.status)} anime cannot receive episode reminders.`;
  if (!args.channelId) return "Choose a notification channel first.";
  return "Ready to subscribe.";
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
