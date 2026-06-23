import type { AnimeSearchMediaType, AnimeSearchResult } from "@/lib/api-client";

export interface AnimeLookupHistoryEntry {
    id: number;
    title: string;
    mediaType: AnimeSearchMediaType;
    status?: string | null;
    format?: string | null;
    coverImageUrl?: string | null;
    recordedAt: number;
    subscribable: boolean;
}

function formatLookupTitle(anime: AnimeSearchResult): string {
    return anime.title.english || anime.title.romaji || anime.title.native || `AniList #${anime.id}`;
}

function isLookupSubscribable(anime: AnimeSearchResult): boolean {
    return anime.type !== "MANGA" && anime.status !== "FINISHED" && anime.status !== "CANCELLED";
}

function normalizeQuery(value: string): string {
    return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function historyKey(entry: Pick<AnimeLookupHistoryEntry, "id" | "mediaType">): string {
    return `${entry.mediaType}:${entry.id}`;
}

export function createAnimeLookupHistoryEntry(
    anime: AnimeSearchResult,
    mediaType: AnimeSearchMediaType,
    recordedAt = Date.now(),
): AnimeLookupHistoryEntry {
    return {
        id: anime.id,
        title: formatLookupTitle(anime),
        mediaType: anime.type === "MANGA" ? "manga" : mediaType,
        status: anime.status ?? null,
        format: anime.format ?? null,
        coverImageUrl: anime.coverImage?.large ?? null,
        recordedAt,
        subscribable: isLookupSubscribable(anime),
    };
}

export function addAnimeLookupHistoryEntry(
    current: AnimeLookupHistoryEntry[],
    entry: AnimeLookupHistoryEntry,
    limit = 8,
): AnimeLookupHistoryEntry[] {
    const next = [entry, ...current.filter((item) => historyKey(item) !== historyKey(entry))]
        .sort((left, right) => right.recordedAt - left.recordedAt || left.title.localeCompare(right.title));
    return next.slice(0, Math.max(0, limit));
}

export function filterAnimeLookupHistory(
    history: AnimeLookupHistoryEntry[],
    mediaType: AnimeSearchMediaType | "all" = "all",
    query = "",
): AnimeLookupHistoryEntry[] {
    const normalizedQuery = normalizeQuery(query);
    return history.filter((entry) => {
        if (mediaType !== "all" && entry.mediaType !== mediaType) return false;
        if (!normalizedQuery) return true;
        return [
            entry.title,
            entry.id.toString(),
            entry.status,
            entry.format,
            entry.subscribable ? "subscribable" : "lookup only",
            entry.mediaType,
        ].some((value) => typeof value === "string" && normalizeQuery(value).includes(normalizedQuery));
    });
}

export function parseAnimeLookupHistory(value: string | null): AnimeLookupHistoryEntry[] {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((item): AnimeLookupHistoryEntry[] => {
            if (!item || typeof item !== "object") return [];
            const record = item as Record<string, unknown>;
            const id = Number(record.id);
            const mediaType = record.mediaType;
            const title = typeof record.title === "string" ? record.title.trim() : "";
            const recordedAt = Number(record.recordedAt);
            if (!Number.isInteger(id) || id <= 0 || !title || (mediaType !== "anime" && mediaType !== "manga") || !Number.isFinite(recordedAt)) {
                return [];
            }
            return [{
                id,
                title,
                mediaType,
                status: typeof record.status === "string" ? record.status : null,
                format: typeof record.format === "string" ? record.format : null,
                coverImageUrl: typeof record.coverImageUrl === "string" ? record.coverImageUrl : null,
                recordedAt,
                subscribable: Boolean(record.subscribable),
            }];
        });
    } catch {
        return [];
    }
}
