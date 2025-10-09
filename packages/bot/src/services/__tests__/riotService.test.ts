import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupServiceTest } from '@zeffuro/fakegaming-common/testing';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

vi.mock('twisted');

const { mockGetByPUUID, mockGetByRiotId, mockMatchList, mockMatchGet, mockLeagueByPUUID, mockTftMatchList, mockTftMatchGet } = vi.hoisted(() => ({
    mockGetByPUUID: vi.fn(),
    mockGetByRiotId: vi.fn(),
    mockMatchList: vi.fn(),
    mockMatchGet: vi.fn(),
    mockLeagueByPUUID: vi.fn(),
    mockTftMatchList: vi.fn(),
    mockTftMatchGet: vi.fn(),
}));

vi.mock('twisted', () => ({
    RiotApi: vi.fn(() => ({
        Account: { getByRiotId: mockGetByRiotId },
    })),
    LolApi: vi.fn(() => ({
        Summoner: { getByPUUID: mockGetByPUUID },
        MatchV5: {
            list: mockMatchList,
            get: mockMatchGet,
        },
        League: { byPUUID: mockLeagueByPUUID },
    })),
    TftApi: vi.fn(() => ({
        Match: {
            list: mockTftMatchList,
            get: mockTftMatchGet,
        },
    })),
}));

import { getSummoner, getPUUIDByRiotId, getMatchHistory, getMatchDetails, getSummonerDetails, resolveLeagueIdentity, getTftMatchHistory, getTftMatchDetails } from '../riotService.js';

describe('riotService', () => {
    let configManager: ReturnType<typeof getConfigManager>;

    beforeEach(async () => {
        const setup = await setupServiceTest();
        configManager = setup.configManager;

        vi.clearAllMocks();
        process.env.RIOT_LEAGUE_API_KEY = 'test-api-key';
        process.env.RIOT_DEV_API_KEY = 'test-dev-api-key';
    });

    describe('getSummoner', () => {
        it('should return summoner data for valid PUUID', async () => {
            const mockSummonerData = {
                puuid: 'test-puuid',
                name: 'TestSummoner',
                summonerLevel: 100,
                profileIconId: 1234,
            };

            mockGetByPUUID.mockResolvedValue({ response: mockSummonerData });

            const result = await getSummoner('test-puuid', 'na1' as any);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockSummonerData);
            expect(mockGetByPUUID).toHaveBeenCalledWith('test-puuid', 'na1');
        });

        it('should return error for malformed summoner data', async () => {
            mockGetByPUUID.mockResolvedValue({ response: { invalid: 'data' } });

            const result = await getSummoner('test-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Malformed summoner data');
        });

        it('should handle "not found" error', async () => {
            mockGetByPUUID.mockRejectedValue(new Error('Summoner not found'));

            const result = await getSummoner('invalid-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('not found');
        });

        it('should handle generic errors', async () => {
            mockGetByPUUID.mockRejectedValue(new Error('API rate limit exceeded'));

            const result = await getSummoner('test-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle "fail" error', async () => {
            mockGetByPUUID.mockRejectedValue(new Error('fail'));

            const result = await getSummoner('test-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('fail');
        });

        it('should handle string errors', async () => {
            mockGetByPUUID.mockRejectedValue('Error string');

            const result = await getSummoner('test-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Error string');
        });
    });

    describe('getPUUIDByRiotId', () => {
        it('should fetch and cache PUUID by Riot ID', async () => {
            mockGetByRiotId.mockResolvedValue({
                response: { puuid: 'cached-puuid' },
            });

            const result1 = await getPUUIDByRiotId('TestUser', 'NA1', 'americas' as any);
            const result2 = await getPUUIDByRiotId('testuser', 'na1', 'americas' as any); // Case insensitive

            expect(result1).toBe('cached-puuid');
            expect(result2).toBe('cached-puuid');
            expect(mockGetByRiotId).toHaveBeenCalledTimes(1); // Cached on second call
        });

        it('should throw error when PUUID fetch fails', async () => {
            mockGetByRiotId.mockRejectedValue(new Error('Failed'));

            await expect(
                getPUUIDByRiotId('Invalid', 'NA1', 'americas' as any)
            ).rejects.toThrow('Failed to fetch PUUID by Riot ID');
        });
    });

    describe('getMatchHistory', () => {
        it('should fetch match history successfully', async () => {
            const mockMatches = ['match1', 'match2', 'match3'];
            mockMatchList.mockResolvedValue({ response: mockMatches });

            const result = await getMatchHistory('test-puuid', 'americas' as any, 0, 20);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockMatches);
            expect(mockMatchList).toHaveBeenCalledWith('test-puuid', 'americas', { start: 0, count: 20 });
        });

        it('should handle match history errors', async () => {
            mockMatchList.mockRejectedValue(new Error('Match history error'));

            const result = await getMatchHistory('test-puuid', 'americas' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Match history error');
        });
    });

    describe('getMatchDetails', () => {
        it('should fetch match details successfully', async () => {
            const mockMatch = { gameId: 12345, participants: [] };
            mockMatchGet.mockResolvedValue({ response: mockMatch });

            const result = await getMatchDetails('match-id', 'americas' as any);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockMatch);
        });

        it('should handle match details errors', async () => {
            mockMatchGet.mockRejectedValue(new Error('Match not found'));

            const result = await getMatchDetails('invalid-match', 'americas' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Match not found');
        });
    });

    describe('getSummonerDetails', () => {
        it('should fetch summoner ranked stats successfully', async () => {
            const mockStats = [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II' }];
            mockLeagueByPUUID.mockResolvedValue({ response: mockStats });

            const result = await getSummonerDetails('test-puuid', 'na1' as any);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockStats);
        });

        it('should handle summoner details errors', async () => {
            mockLeagueByPUUID.mockRejectedValue(new Error('Stats error'));

            const result = await getSummonerDetails('test-puuid', 'na1' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Stats error');
        });
    });

    describe('resolveLeagueIdentity', () => {
        it('should use user config when no summoner provided', async () => {
            const mockUser = {
                userId: 'user-123',
                league: {
                    summonerName: 'ConfigUser',
                    region: 'euw1',
                    puuid: 'config-puuid',
                },
            };

            vi.spyOn(configManager.userManager, 'getUserWithLeague').mockResolvedValue(mockUser as any);

            const result = await resolveLeagueIdentity({ userId: 'user-123' });

            expect(result.summoner).toBe('ConfigUser');
            expect(result.region).toBe('euw1');
            expect(result.puuid).toBe('config-puuid');
        });

        it('should throw when summoner name is provided without tagline', async () => {
            await expect(
                resolveLeagueIdentity({
                    summoner: 'TestUser',
                    region: 'euw1' as any,
                })
            ).rejects.toThrow('Riot ID must include a tagline');
        });

        it('should resolve when Riot ID with tagline is provided', async () => {
            // Given a Riot ID with tagline, we should call Account.getByRiotId and resolve PUUID
            mockGetByRiotId.mockResolvedValue({ response: { puuid: 'resolved-puuid' } });

            const result = await resolveLeagueIdentity({
                summoner: 'TestUser#EUW',
                region: 'euw1' as any,
            });

            expect(result.puuid).toBe('resolved-puuid');
            expect(mockGetByRiotId).toHaveBeenCalled();
        });
    });

    describe('getTftMatchHistory', () => {
        it('should fetch TFT match history successfully', async () => {
            const mockMatches = ['tft-match1', 'tft-match2'];
            mockTftMatchList.mockResolvedValue({ response: mockMatches });

            const result = await getTftMatchHistory('test-puuid', 'americas' as any, 0, 20);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockMatches);
        });

        it('should handle TFT match history errors', async () => {
            mockTftMatchList.mockRejectedValue(new Error('TFT error'));

            const result = await getTftMatchHistory('test-puuid', 'americas' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('TFT error');
        });
    });

    describe('getTftMatchDetails', () => {
        it('should fetch TFT match details successfully', async () => {
            const mockMatch = { gameId: 67890, participants: [] };
            mockTftMatchGet.mockResolvedValue({ response: mockMatch });

            const result = await getTftMatchDetails('tft-match-id', 'americas' as any);

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockMatch);
        });

        it('should handle TFT match details errors', async () => {
            mockTftMatchGet.mockRejectedValue(new Error('TFT match not found'));

            const result = await getTftMatchDetails('invalid-tft-match', 'americas' as any);

            expect(result.success).toBe(false);
            expect(result.error).toBe('TFT match not found');
        });
    });
});
