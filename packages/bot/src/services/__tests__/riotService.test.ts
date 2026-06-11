import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLolApi, mockRiotApi, mockTftApi } = vi.hoisted(() => {
    const mockLolApi = {
        Summoner: { getByPUUID: vi.fn() },
        MatchV5: { list: vi.fn(), get: vi.fn() },
        League: { byPUUID: vi.fn() }
    };
    const mockRiotApi = {
        Account: { getByRiotId: vi.fn() }
    };
    const mockTftApi = {
        Match: { list: vi.fn(), get: vi.fn() },
        Summoner: { getByPUUID: vi.fn() },
        League: { getByPUUID: vi.fn() }
    };
    return { mockLolApi, mockRiotApi, mockTftApi };
});

vi.mock('twisted', () => ({
    Constants: {
        Regions: {
            BRAZIL: 'BR1',
            EU_EAST: 'EUN1',
            EU_WEST: 'EUW1',
            KOREA: 'KR',
            LAT_NORTH: 'LA1',
            LAT_SOUTH: 'LA2',
            AMERICA_NORTH: 'NA1',
            OCEANIA: 'OC1',
            TURKEY: 'TR1',
            RUSSIA: 'RU',
            JAPAN: 'JP1',
            VIETNAM: 'VN2',
            TAIWAN: 'TW2',
            SINGAPORE: 'SG2',
            MIDDLE_EAST: 'ME1',
            PBE: 'PBE1'
        },
        RegionGroups: {
            ASIA: 'ASIA',
            AMERICAS: 'AMERICAS',
            EUROPE: 'EUROPE',
            SEA: 'SEA'
        },
        regionToRegionGroup: vi.fn().mockReturnValue('EUROPE'),
        regionToRegionGroupForAccountAPI: vi.fn().mockReturnValue('EUROPE')
    },
    RiotApi: vi.fn().mockImplementation(function() { return mockRiotApi; }),
    LolApi: vi.fn().mockImplementation(function() { return mockLolApi; }),
    TftApi: vi.fn().mockImplementation(function() { return mockTftApi; })
}));

// Import after mocks are defined
import {
    getMatchDetails,
    getMatchHistory,
    getPUUIDByRiotId,
    getSummoner,
    getSummonerDetails,
    getTftMatchDetails,
    getTftMatchHistory,
    getTftSummoner,
    resolveLeagueIdentity
} from '../riotService.js';
import { createMockConfigManager, createMockUserWithLeague } from '@zeffuro/fakegaming-common/testing';
import type { Regions } from '../../modules/league/constants/riotRegions.js';
import { LolApi, RiotApi, TftApi } from 'twisted';

describe('riotService helpers', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.RIOT_ACCOUNT_API_KEY;
        delete process.env.RIOT_LEAGUE_API_KEY;
        delete process.env.RIOT_TFT_API_KEY;
        process.env.RIOT_DEV_API_KEY = 'test-dev-key';
        // Reset methods to fresh fn to avoid cross-test calls accumulation
        mockLolApi.Summoner.getByPUUID = vi.fn();
        mockLolApi.MatchV5.list = vi.fn();
        mockLolApi.MatchV5.get = vi.fn();
        mockLolApi.League.byPUUID = vi.fn();
        mockRiotApi.Account.getByRiotId = vi.fn();
        mockTftApi.Match.list = vi.fn();
        mockTftApi.Match.get = vi.fn();
        mockTftApi.Summoner.getByPUUID = vi.fn();
        mockTftApi.League.getByPUUID = vi.fn();
    });

    it('unwraps response for match history (success)', async () => {
        mockLolApi.MatchV5.list.mockResolvedValue({ response: ['m1', 'm2'] });
        const res = await getMatchHistory('puuid', 'EUROPE' as any, 0, 2);
        expect(res.success).toBe(true);
        expect(res.data).toEqual(['m1', 'm2']);
    });

    it('returns Riot payload error from data for getSummoner', async () => {
        mockLolApi.Summoner.getByPUUID.mockResolvedValue({ response: { status: { status_code: 404, message: 'Not Found' } } });
        const res = await getSummoner('puuid', 'EUW' as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe('404 Not Found');
    });

    it('maps thrown error to not found for getSummoner', async () => {
        mockLolApi.Summoner.getByPUUID.mockRejectedValue(new Error('Summoner not found'));
        const res = await getSummoner('puuid', 'EUW' as any);
        expect(res.success).toBe(false);
        expect(res.error).toBe('not found');
    });

    it('extracts Riot status payloads from thrown HTTP errors', async () => {
        mockLolApi.Summoner.getByPUUID.mockRejectedValue({
            response: {
                data: {
                    status: {
                        status_code: 400,
                        message: 'Bad Request - Exception decrypting puuid'
                    }
                }
            }
        });

        const res = await getSummoner('puuid', 'EUW' as any);

        expect(res.success).toBe(false);
        expect(res.error).toBe('400 Bad Request - Exception decrypting puuid');
    });

    it('normalizes malformed summoner payloads and fail errors', async () => {
        mockLolApi.Summoner.getByPUUID.mockResolvedValueOnce({ response: { puuid: 'p1' } });
        await expect(getSummoner('puuid', 'EUW' as any)).resolves.toEqual({
            success: false,
            error: 'Malformed summoner data'
        });

        mockLolApi.Summoner.getByPUUID.mockRejectedValueOnce(new Error('fail'));
        await expect(getSummoner('puuid', 'EUW' as any)).resolves.toEqual({
            success: false,
            error: 'fail'
        });
    });

    it('unwraps match details and ranked summoner details', async () => {
        mockLolApi.MatchV5.get.mockResolvedValueOnce({ response: { metadata: { matchId: 'm1' } } });
        await expect(getMatchDetails('m1', 'EUROPE' as any)).resolves.toEqual({
            success: true,
            data: { metadata: { matchId: 'm1' } }
        });

        mockLolApi.League.byPUUID.mockResolvedValueOnce({ response: [{ queueType: 'RANKED_SOLO_5x5' }] });
        await expect(getSummonerDetails('puuid', 'EUW' as any)).resolves.toEqual({
            success: true,
            data: [{ queueType: 'RANKED_SOLO_5x5' }]
        });
    });

    it('unwraps TFT match details (success)', async () => {
        mockTftApi.Match.get.mockResolvedValue({ response: { info: { queue_id: 1100 } } });
        const res = await getTftMatchDetails('match-1', 'EUROPE' as any);
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ info: { queue_id: 1100 } });
    });

    it('unwraps TFT match history and normalizes thrown payload errors', async () => {
        mockTftApi.Match.list.mockResolvedValueOnce({ response: ['tft-1'] });
        await expect(getTftMatchHistory('puuid', 'EUROPE' as any)).resolves.toEqual({
            success: true,
            data: ['tft-1']
        });

        mockTftApi.Match.list.mockRejectedValueOnce({ status: { status_code: 429, message: 'Rate limited' } });
        await expect(getTftMatchHistory('puuid', 'EUROPE' as any)).resolves.toEqual({
            success: false,
            error: '429 Rate limited'
        });
    });

    it('uses the dedicated League key for League API calls', async () => {
        process.env.RIOT_LEAGUE_API_KEY = 'league-key';
        process.env.RIOT_DEV_API_KEY = 'dev-key';
        mockLolApi.MatchV5.list.mockResolvedValueOnce({ response: [] });

        await expect(getMatchHistory('puuid', 'EUROPE' as any)).resolves.toEqual({
            success: true,
            data: []
        });
        expect(LolApi).toHaveBeenCalledWith({ key: 'league-key' });
    });

    it('uses the dedicated TFT key for TFT API calls', async () => {
        process.env.RIOT_TFT_API_KEY = 'tft-key';
        process.env.RIOT_DEV_API_KEY = 'dev-key';
        mockTftApi.Summoner.getByPUUID.mockResolvedValueOnce({ response: { puuid: 'puuid', summonerLevel: 10 } });

        await expect(getTftSummoner('puuid', 'EUW' as any)).resolves.toEqual({
            success: true,
            data: { puuid: 'puuid', summonerLevel: 10 }
        });
        expect(TftApi).toHaveBeenCalledWith({ key: 'tft-key' });
    });

    it('uses the dedicated Account key for Riot ID lookups when configured', async () => {
        process.env.RIOT_ACCOUNT_API_KEY = 'account-key';
        process.env.RIOT_LEAGUE_API_KEY = 'league-key';
        mockRiotApi.Account.getByRiotId.mockResolvedValueOnce({ response: { puuid: 'account-key-puuid' } });

        await expect(getPUUIDByRiotId('AccountKeyUser', 'EUW', 'EUROPE' as any)).resolves.toBe('account-key-puuid');
        expect(RiotApi).toHaveBeenCalledWith({ key: 'account-key' });
    });

    it('falls back to the TFT key for Riot ID lookups when no account or League key exists', async () => {
        delete process.env.RIOT_ACCOUNT_API_KEY;
        delete process.env.RIOT_LEAGUE_API_KEY;
        delete process.env.RIOT_DEV_API_KEY;
        process.env.RIOT_TFT_API_KEY = 'tft-key';
        mockRiotApi.Account.getByRiotId.mockResolvedValueOnce({ response: { puuid: 'tft-key-puuid' } });

        await expect(getPUUIDByRiotId('TftOnlyUser', 'EUW', 'EUROPE' as any)).resolves.toBe('tft-key-puuid');
        expect(RiotApi).toHaveBeenCalledWith({ key: 'tft-key' });
    });

    it('fetches PUUIDs by Riot ID and uses the case-insensitive cache', async () => {
        mockRiotApi.Account.getByRiotId.mockResolvedValueOnce({ response: { puuid: 'cached-puuid' } });

        await expect(getPUUIDByRiotId('CacheUser', 'EUW', 'EUROPE' as any)).resolves.toBe('cached-puuid');
        await expect(getPUUIDByRiotId(' cacheuser ', ' euw ', 'EUROPE' as any)).resolves.toBe('cached-puuid');
        expect(mockRiotApi.Account.getByRiotId).toHaveBeenCalledTimes(1);
    });

    it('throws a stable error when Riot ID PUUID lookup fails', async () => {
        mockRiotApi.Account.getByRiotId.mockRejectedValueOnce(new Error('riot down'));

        await expect(getPUUIDByRiotId('FailureUser', 'EUW', 'EUROPE' as any)).rejects.toThrow('Failed to fetch PUUID by Riot ID');
    });

    it('refreshes stale linked PUUIDs from Riot ID and persists the update', async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        mockRiotApi.Account.getByRiotId.mockResolvedValueOnce({ response: { puuid: 'fresh-puuid' } });
        createMockConfigManager({
            userManager: {
                getUserWithLeague: vi.fn().mockResolvedValue(createMockUserWithLeague({
                    league: {
                        summonerName: 'LinkedName#EUW',
                        region: 'euw1',
                        puuid: 'stale-puuid',
                        update,
                    } as any
                }))
            }
        });

        await expect(resolveLeagueIdentity({ userId: 'discord-1' })).resolves.toEqual({
            summoner: 'LinkedName#EUW',
            region: 'euw1',
            puuid: 'fresh-puuid'
        });
        expect(mockRiotApi.Account.getByRiotId).toHaveBeenCalledWith('LinkedName', 'EUW', expect.any(String));
        expect(update).toHaveBeenCalledWith({ puuid: 'fresh-puuid' });
    });

    it('falls back to the stored linked PUUID when refresh fails', async () => {
        mockRiotApi.Account.getByRiotId.mockRejectedValueOnce(new Error('riot down'));
        createMockConfigManager({
            userManager: {
                getUserWithLeague: vi.fn().mockResolvedValue(createMockUserWithLeague({
                    league: {
                        summonerName: 'LinkedName#EUW',
                        region: 'euw1',
                        puuid: 'stored-puuid'
                    } as any
                }))
            }
        });

        await expect(resolveLeagueIdentity({ userId: 'discord-1' })).resolves.toEqual({
            summoner: 'LinkedName#EUW',
            region: 'euw1',
            puuid: 'stored-puuid'
        });
    });

    it('resolves unlinked Riot IDs with fallback account routing', async () => {
        mockRiotApi.Account.getByRiotId.mockResolvedValueOnce({ response: { puuid: 'new-puuid' } });

        await expect(resolveLeagueIdentity({
            summoner: 'NewName#EUW',
            region: 'euw1' as unknown as Regions
        })).resolves.toEqual({
            summoner: 'NewName#EUW',
            region: 'euw1',
            puuid: 'new-puuid'
        });
        expect(mockRiotApi.Account.getByRiotId).toHaveBeenCalledWith('NewName', 'EUW', expect.any(String));
    });

    it('rejects missing or name-only League identity input', async () => {
        await expect(resolveLeagueIdentity({})).rejects.toThrow('Missing summoner or region');
        await expect(resolveLeagueIdentity({
            summoner: 'NameOnly',
            region: 'euw1' as unknown as Regions
        })).rejects.toThrow('Riot ID must include a tagline');
    });
});
