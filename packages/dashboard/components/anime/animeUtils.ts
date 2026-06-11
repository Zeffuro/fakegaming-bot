import type { AnimeSearchResult, AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import {
  formatAniListCountryOfOrigin,
  formatAniListMediaFormat,
  formatAniListPopularity,
  formatAniListRanking,
  formatAniListScore,
  formatAniListStatus,
} from "@zeffuro/fakegaming-common/anime";

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
  return formatAniListStatus(status);
}

export function formatAnimeMeta(anime: AnimeSearchResult): string {
  if (anime.type === "MANGA") {
    return [
      formatAniListCountryOfOrigin(anime.countryOfOrigin),
      formatAniListMediaFormat({ format: anime.format, type: anime.type, countryOfOrigin: anime.countryOfOrigin }),
      formatStatus(anime.status),
      anime.chapters ? `${anime.chapters} Chapters` : null,
      anime.volumes ? `${anime.volumes} Volumes` : null,
      formatAniListScore(anime),
      anime.popularity ? `${formatAniListPopularity(anime.popularity)} Users` : null,
    ].filter(Boolean).join(" - ");
  }

  return [
    anime.seasonYear ?? "Unknown Year",
    formatAniListMediaFormat({ format: anime.format, type: anime.type ?? "ANIME", countryOfOrigin: anime.countryOfOrigin }),
    formatStatus(anime.status),
    anime.episodes ? `${anime.episodes} Episodes` : null,
    formatAniListScore(anime),
    anime.popularity ? `${formatAniListPopularity(anime.popularity)} Users` : null,
  ].filter(Boolean).join(" - ");
}

export function formatAiring(ms?: number | null): string {
  if (!ms) return "No upcoming episode known";
  return airingDateFormatter.format(new Date(ms));
}

export function formatNextEpisode(anime: AnimeSearchResult): string | null {
  if (anime.type === "MANGA") return null;
  if (!anime.nextAiringEpisode) return null;
  return `Episode ${anime.nextAiringEpisode.episode} Airs ${formatAiring(anime.nextAiringEpisode.airingAt * 1000)}`;
}

export function formatRankings(anime: Pick<AnimeSearchResult, "rankings">): string[] {
  const rankings = anime.rankings?.filter((rank) => rank.allTime).slice(0, 2) ?? anime.rankings?.slice(0, 2) ?? [];
  return rankings.map(formatAniListRanking);
}

export function canSubscribe(anime?: Pick<AnimeSearchResult, "status" | "type"> | null): boolean {
  return Boolean(anime && anime.type !== "MANGA" && anime.status !== "FINISHED" && anime.status !== "CANCELLED");
}

export function subscriptionTitle(config: AnimeSubscriptionDashboardConfig): string {
  return config.animeTitle || `AniList #${config.anilistId}`;
}

export function subscriptionMeta(config: AnimeSubscriptionDashboardConfig): string {
  return [
    config.format ? formatAniListMediaFormat({ format: config.format, type: "ANIME" }) : null,
    config.status ? formatAniListStatus(config.status) : null,
    config.nextEpisode && config.nextAiringAt ? `Episode ${config.nextEpisode} ${formatAiring(Number(config.nextAiringAt))}` : null,
    `${config.reminderMinutes ?? 30} Min Reminder`,
  ].filter(Boolean).join(" - ");
}

export function getSubscribeHint(args: { anime?: AnimeSearchResult | null; channelId?: string; saving?: boolean }): string {
  if (args.saving) return "Saving...";
  if (args.anime?.type === "MANGA") return "Manga results are lookup-only; episode reminders are anime-only.";
  if (args.anime && !canSubscribe(args.anime)) return `${formatStatus(args.anime.status)} anime cannot receive episode reminders.`;
  if (!args.channelId) return "Choose a notification channel first.";
  return "Ready to subscribe.";
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
