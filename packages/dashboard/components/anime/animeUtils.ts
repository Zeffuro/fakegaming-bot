import type { AnimeSearchResult, AnimeSubscriptionDashboardConfig } from "@/lib/api-client";
import { getDashboardIntlLocale, type DashboardLocale } from "@/lib/i18n/localeStore";
import { formatDashboardMessage } from "@/lib/i18n/messages";
import {
  formatAniListCountryOfOrigin,
  formatAniListMediaFormat,
  formatAniListPopularity,
  formatAniListRanking,
  formatAniListScore,
  formatAniListStatus,
} from "@zeffuro/fakegaming-common/anime";

function animeMessage(locale: DashboardLocale, key: "anime.noUpcomingEpisode" | "anime.episodeAirs" | "anime.saving" | "anime.lookupOnly" | "anime.channelFirst" | "anime.ready", values?: Record<string, string | number>): string {
  return formatDashboardMessage(locale, key, values);
}

export function formatAnimeTitle(anime: AnimeSearchResult): string {
  return anime.title.english || anime.title.romaji || anime.title.native || `AniList #${anime.id}`;
}

export function formatStatus(status: string | null | undefined, locale: DashboardLocale): string {
  return formatAniListStatus(status, locale);
}

export function formatAnimeMeta(anime: AnimeSearchResult, locale: DashboardLocale): string {
  if (anime.type === "MANGA") {
    return [
      formatAniListCountryOfOrigin(anime.countryOfOrigin, locale),
      formatAniListMediaFormat({ format: anime.format, type: anime.type, countryOfOrigin: anime.countryOfOrigin }, locale),
      formatStatus(anime.status, locale),
      anime.chapters ? formatDashboardMessage(locale, "anime.chapters", { count: anime.chapters }) : null,
      anime.volumes ? formatDashboardMessage(locale, "anime.volumes", { count: anime.volumes }) : null,
      formatAniListScore(anime, locale),
      anime.popularity ? formatDashboardMessage(locale, "anime.users", { count: formatAniListPopularity(anime.popularity, locale) }) : null,
    ].filter(Boolean).join(" - ");
  }

  return [
    anime.seasonYear ?? formatDashboardMessage(locale, "anime.unknownYear"),
    formatAniListMediaFormat({ format: anime.format, type: anime.type ?? "ANIME", countryOfOrigin: anime.countryOfOrigin }, locale),
    formatStatus(anime.status, locale),
    anime.episodes ? formatDashboardMessage(locale, "anime.episodes", { count: anime.episodes }) : null,
    formatAniListScore(anime, locale),
    anime.popularity ? formatDashboardMessage(locale, "anime.users", { count: formatAniListPopularity(anime.popularity, locale) }) : null,
  ].filter(Boolean).join(" - ");
}

export function formatAiring(ms: number | null | undefined, locale: DashboardLocale): string {
  if (!ms) return animeMessage(locale, "anime.noUpcomingEpisode");
  return new Intl.DateTimeFormat(getDashboardIntlLocale(locale), { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}

export function formatNextEpisode(anime: AnimeSearchResult, locale: DashboardLocale): string | null {
  if (anime.type === "MANGA") return null;
  if (!anime.nextAiringEpisode) return null;
  return animeMessage(locale, "anime.episodeAirs", { episode: anime.nextAiringEpisode.episode, date: formatAiring(anime.nextAiringEpisode.airingAt * 1000, locale) });
}

export function formatRankings(anime: Pick<AnimeSearchResult, "rankings">, locale: DashboardLocale): string[] {
  const rankings = anime.rankings?.filter((rank) => rank.allTime).slice(0, 2) ?? anime.rankings?.slice(0, 2) ?? [];
  return rankings.map(rank => formatAniListRanking(rank, locale));
}

export function canSubscribe(anime?: Pick<AnimeSearchResult, "status" | "type"> | null): boolean {
  return Boolean(anime && anime.type !== "MANGA" && anime.status !== "FINISHED" && anime.status !== "CANCELLED");
}

export function subscriptionTitle(config: AnimeSubscriptionDashboardConfig): string {
  return config.animeTitle || `AniList #${config.anilistId}`;
}

export function subscriptionMeta(config: AnimeSubscriptionDashboardConfig, locale: DashboardLocale): string {
  return [
    config.format ? formatAniListMediaFormat({ format: config.format, type: "ANIME" }, locale) : null,
    config.status ? formatAniListStatus(config.status, locale) : null,
    config.nextEpisode && config.nextAiringAt ? formatDashboardMessage(locale, "anime.episodeAirs", { episode: config.nextEpisode, date: formatAiring(Number(config.nextAiringAt), locale) }) : null,
    formatDashboardMessage(locale, "anime.minutesReminder", { minutes: config.reminderMinutes ?? 30 }),
  ].filter(Boolean).join(" - ");
}

export function getSubscribeHint(args: { anime?: AnimeSearchResult | null; channelId?: string; saving?: boolean }, locale: DashboardLocale): string {
  if (args.saving) return animeMessage(locale, "anime.saving");
  if (args.anime?.type === "MANGA") return animeMessage(locale, "anime.lookupOnly");
  if (args.anime && !canSubscribe(args.anime)) return formatDashboardMessage(locale, "anime.invalidReminder");
  if (!args.channelId) return animeMessage(locale, "anime.channelFirst");
  return animeMessage(locale, "anime.ready");
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
