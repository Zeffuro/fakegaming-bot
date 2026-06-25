import type { LeagueMatchDto, LeagueMatchParticipantDto } from '../types/riotDtos.js';

export const LEAGUE_RECENT_FORM_SCHEMA_VERSION = 1;
export const DEFAULT_RECENT_FORM_MATCH_COUNT = 5;
export const MAX_RECENT_FORM_MATCH_COUNT = 10;
export const DEFAULT_RECENT_FORM_TTL_MINUTES = 60;

export type LeagueRecentFormStatus = 'fresh' | 'empty_history' | 'partial';
export type LeagueRecentFormResult = 'W' | 'L';

export interface LeagueRecentFormChampionSummary {
    name: string;
    games: number;
    wins: number;
}

export interface LeagueRecentFormSnapshot {
    schemaVersion: typeof LEAGUE_RECENT_FORM_SCHEMA_VERSION;
    game: 'league';
    region: string;
    matchCount: number;
    wins: number;
    losses: number;
    averageKills: number;
    averageDeaths: number;
    averageAssists: number;
    averageCsPerMinute: number;
    averageVisionScore: number;
    topChampions: LeagueRecentFormChampionSummary[];
    recentResults: LeagueRecentFormResult[];
    lastMatchAt: string | null;
    refreshedAt: string;
    expiresAt: string;
    status: LeagueRecentFormStatus;
}

interface BuildLeagueRecentFormOptions {
    now?: Date;
    ttlMs: number;
    requestedMatchCount?: number;
    failedDetailCount?: number;
}

interface ParticipantMatch {
    match: LeagueMatchDto;
    participant: LeagueMatchParticipantDto;
}

interface ChampionAccumulator {
    name: string;
    games: number;
    wins: number;
}

export function getRecentFormMatchCount(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = Number.parseInt(env.RIOT_RECENT_FORM_MATCH_COUNT ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RECENT_FORM_MATCH_COUNT;
    return Math.min(parsed, MAX_RECENT_FORM_MATCH_COUNT);
}

export function getRecentFormTtlMs(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = Number.parseInt(env.RIOT_RECENT_FORM_TTL_MINUTES ?? '', 10);
    const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECENT_FORM_TTL_MINUTES;
    return minutes * 60 * 1000;
}

export function buildLeagueRecentFormSnapshot(
    matches: LeagueMatchDto[],
    identity: { puuid: string; region: string },
    options: BuildLeagueRecentFormOptions
): LeagueRecentFormSnapshot {
    const now = options.now ?? new Date();
    const participantMatches = getParticipantMatches(matches, identity.puuid);
    const requestedMatchCount = options.requestedMatchCount ?? matches.length;
    const failedDetailCount = options.failedDetailCount ?? 0;
    const expiresAt = new Date(now.getTime() + options.ttlMs);

    if (participantMatches.length === 0) {
        return {
            schemaVersion: LEAGUE_RECENT_FORM_SCHEMA_VERSION,
            game: 'league',
            region: identity.region,
            matchCount: 0,
            wins: 0,
            losses: 0,
            averageKills: 0,
            averageDeaths: 0,
            averageAssists: 0,
            averageCsPerMinute: 0,
            averageVisionScore: 0,
            topChampions: [],
            recentResults: [],
            lastMatchAt: null,
            refreshedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            status: 'empty_history',
        };
    }

    const totals = participantMatches.reduce(
        (acc, item) => {
            const participant = item.participant;
            const durationMinutes = getDurationMinutes(item.match, participant);
            const cs = (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0);
            acc.wins += participant.win ? 1 : 0;
            acc.kills += participant.kills ?? 0;
            acc.deaths += participant.deaths ?? 0;
            acc.assists += participant.assists ?? 0;
            acc.csPerMinute += cs / durationMinutes;
            acc.visionScore += participant.visionScore ?? 0;
            return acc;
        },
        {
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            csPerMinute: 0,
            visionScore: 0,
        }
    );

    const matchCount = participantMatches.length;
    const missingParticipants = Math.max(0, matches.length - participantMatches.length);
    const isPartial = failedDetailCount > 0 || missingParticipants > 0 || requestedMatchCount > matches.length;

    return {
        schemaVersion: LEAGUE_RECENT_FORM_SCHEMA_VERSION,
        game: 'league',
        region: identity.region,
        matchCount,
        wins: totals.wins,
        losses: matchCount - totals.wins,
        averageKills: roundOne(totals.kills / matchCount),
        averageDeaths: roundOne(totals.deaths / matchCount),
        averageAssists: roundOne(totals.assists / matchCount),
        averageCsPerMinute: roundOne(totals.csPerMinute / matchCount),
        averageVisionScore: roundOne(totals.visionScore / matchCount),
        topChampions: getTopChampions(participantMatches),
        recentResults: participantMatches.slice(0, MAX_RECENT_FORM_MATCH_COUNT).map((item) => item.participant.win ? 'W' : 'L'),
        lastMatchAt: getLastMatchAt(participantMatches),
        refreshedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: isPartial ? 'partial' : 'fresh',
    };
}

function getParticipantMatches(matches: LeagueMatchDto[], puuid: string): ParticipantMatch[] {
    const participantMatches: ParticipantMatch[] = [];
    for (const match of matches) {
        const participant = match.info.participants.find((item) => item.puuid === puuid);
        if (participant) {
            participantMatches.push({ match, participant });
        }
    }
    return participantMatches;
}

function getDurationMinutes(match: LeagueMatchDto, participant: LeagueMatchParticipantDto): number {
    const seconds = participant.timePlayed || Math.floor((match.info.gameDuration ?? 0) / 1000);
    return Math.max(1, seconds / 60);
}

function getTopChampions(participantMatches: ParticipantMatch[]): LeagueRecentFormChampionSummary[] {
    const champions = new Map<string, ChampionAccumulator>();
    for (const item of participantMatches) {
        const name = getChampionName(item.participant);
        const existing = champions.get(name) ?? { name, games: 0, wins: 0 };
        existing.games += 1;
        existing.wins += item.participant.win ? 1 : 0;
        champions.set(name, existing);
    }

    return [...champions.values()]
        .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name))
        .slice(0, 3)
        .map((item) => ({ name: item.name, games: item.games, wins: item.wins }));
}

function getChampionName(participant: LeagueMatchParticipantDto): string {
    const name = participant.championName?.trim();
    return name || `Champion ${participant.championId}`;
}

function getLastMatchAt(participantMatches: ParticipantMatch[]): string | null {
    const timestamps = participantMatches
        .map((item) => item.match.info.gameEndTimestamp)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toISOString();
}

function roundOne(value: number): number {
    return Math.round(value * 10) / 10;
}
