import type { LeagueRecentFormSnapshot } from './leagueRecentForm.js';

const cache = new Map<string, LeagueRecentFormSnapshot>();

export function getLeagueRecentFormCacheKey(region: string, puuid: string): string {
    return `riot:recent-form:v1:league:${region.toLowerCase()}:${puuid}`;
}

export function getCachedLeagueRecentForm(key: string, now: Date = new Date()): LeagueRecentFormSnapshot | null {
    const snapshot = cache.get(key);
    if (!snapshot) return null;

    const expiresAt = Date.parse(snapshot.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
        cache.delete(key);
        return null;
    }

    return snapshot;
}

export function setCachedLeagueRecentForm(key: string, snapshot: LeagueRecentFormSnapshot): void {
    cache.set(key, snapshot);
}

export function clearLeagueRecentFormCacheForTests(): void {
    cache.clear();
}
