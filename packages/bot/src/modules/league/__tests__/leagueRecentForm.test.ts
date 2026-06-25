import { describe, expect, it } from 'vitest';
import {
    DEFAULT_RECENT_FORM_MATCH_COUNT,
    DEFAULT_RECENT_FORM_TTL_MINUTES,
    MAX_RECENT_FORM_MATCH_COUNT,
    buildLeagueRecentFormSnapshot,
    getRecentFormMatchCount,
    getRecentFormTtlMs,
} from '../recentForm/leagueRecentForm.js';
import type { LeagueMatchDto, LeagueMatchParticipantDto } from '../types/riotDtos.js';

const PLAYER_PUUID = 'player-puuid';
const NOW = new Date('2026-06-25T12:00:00.000Z');
const TTL_MS = 60 * 60 * 1000;

describe('leagueRecentForm', () => {
    it('aggregates recent League form without preserving raw match data', () => {
        const matches = [
            match(participant({ win: true, championId: 101, championName: 'Lux', kills: 8, deaths: 2, assists: 10, totalMinionsKilled: 160, neutralMinionsKilled: 20, visionScore: 24, timePlayed: 1800 }), 1000),
            match(participant({ win: false, championId: 101, championName: 'Lux', kills: 4, deaths: 6, assists: 8, totalMinionsKilled: 120, neutralMinionsKilled: 12, visionScore: 12, timePlayed: 1500 }), 2000),
            match(participant({ win: true, championId: 22, championName: 'Ashe', kills: 6, deaths: 3, assists: 7, totalMinionsKilled: 140, neutralMinionsKilled: 0, visionScore: 18, timePlayed: 1200 }), 3000),
        ];

        const snapshot = buildLeagueRecentFormSnapshot(matches, { puuid: PLAYER_PUUID, region: 'EUW1' }, {
            now: NOW,
            ttlMs: TTL_MS,
            requestedMatchCount: matches.length,
        });

        expect(snapshot).toMatchObject({
            game: 'league',
            region: 'EUW1',
            matchCount: 3,
            wins: 2,
            losses: 1,
            averageKills: 6,
            averageDeaths: 3.7,
            averageAssists: 8.3,
            averageCsPerMinute: 6.1,
            averageVisionScore: 18,
            recentResults: ['W', 'L', 'W'],
            lastMatchAt: '1970-01-01T00:00:03.000Z',
            refreshedAt: NOW.toISOString(),
            expiresAt: '2026-06-25T13:00:00.000Z',
            status: 'fresh',
        });
        expect(snapshot.topChampions).toEqual([
            { name: 'Lux', games: 2, wins: 1 },
            { name: 'Ashe', games: 1, wins: 1 },
        ]);
        expect(JSON.stringify(snapshot)).not.toContain(PLAYER_PUUID);
        expect(JSON.stringify(snapshot)).not.toContain('participants');
    });

    it('marks partial summaries when details fail or the player row is missing', () => {
        const matches = [
            match(participant({ win: true, championName: 'Lux' }), 1000),
            match(participant({ puuid: 'other-puuid', win: false, championName: 'Ashe' }), 2000),
        ];

        const snapshot = buildLeagueRecentFormSnapshot(matches, { puuid: PLAYER_PUUID, region: 'NA1' }, {
            now: NOW,
            ttlMs: TTL_MS,
            requestedMatchCount: 3,
            failedDetailCount: 1,
        });

        const { status } = snapshot;
        expect(status).toBe('partial');
        expect(snapshot.matchCount).toBe(1);
        expect(snapshot.wins).toBe(1);
        expect(snapshot.topChampions).toEqual([{ name: 'Lux', games: 1, wins: 1 }]);
    });

    it('returns an empty snapshot when no usable matches are present', () => {
        const snapshot = buildLeagueRecentFormSnapshot([], { puuid: PLAYER_PUUID, region: 'KR' }, {
            now: NOW,
            ttlMs: TTL_MS,
            requestedMatchCount: 0,
        });

        const { status } = snapshot;
        expect(status).toBe('empty_history');
        expect(snapshot.matchCount).toBe(0);
        expect(snapshot.recentResults).toEqual([]);
        expect(snapshot.topChampions).toEqual([]);
    });

    it('bounds env-driven match counts and TTLs', () => {
        expect(getRecentFormMatchCount({ RIOT_RECENT_FORM_MATCH_COUNT: '50' } as NodeJS.ProcessEnv)).toBe(MAX_RECENT_FORM_MATCH_COUNT);
        expect(getRecentFormMatchCount({ RIOT_RECENT_FORM_MATCH_COUNT: '0' } as NodeJS.ProcessEnv)).toBe(DEFAULT_RECENT_FORM_MATCH_COUNT);
        expect(getRecentFormTtlMs({ RIOT_RECENT_FORM_TTL_MINUTES: '2' } as NodeJS.ProcessEnv)).toBe(2 * 60 * 1000);
        expect(getRecentFormTtlMs({ RIOT_RECENT_FORM_TTL_MINUTES: '-1' } as NodeJS.ProcessEnv)).toBe(DEFAULT_RECENT_FORM_TTL_MINUTES * 60 * 1000);
    });
});

function participant(overrides: Partial<LeagueMatchParticipantDto> = {}): LeagueMatchParticipantDto {
    return {
        puuid: PLAYER_PUUID,
        win: true,
        championId: 1,
        championName: 'Annie',
        champLevel: 12,
        summoner1Id: 4,
        summoner2Id: 14,
        kills: 3,
        deaths: 1,
        assists: 5,
        totalMinionsKilled: 100,
        neutralMinionsKilled: 10,
        visionScore: 10,
        timePlayed: 1200,
        teamId: 100,
        item0: 0,
        item1: 0,
        item2: 0,
        item3: 0,
        item4: 0,
        item5: 0,
        item6: 0,
        ...overrides,
    };
}

function match(player: LeagueMatchParticipantDto, gameEndTimestamp: number): LeagueMatchDto {
    return {
        info: {
            participants: [player],
            gameMode: 'CLASSIC',
            queueId: 420,
            gameEndTimestamp,
            gameDuration: player.timePlayed * 1000,
        },
    };
}
