import { describe, it, expect, vi, beforeEach } from 'vitest';

// We will mock the 'twisted' classes used by riotService so we can control responses
const mockLolApi = {
    Summoner: { getByPUUID: vi.fn() },
    MatchV5: { list: vi.fn(), get: vi.fn() },
    League: { byPUUID: vi.fn() }
};
const mockTftApi = {
    Match: { list: vi.fn(), get: vi.fn() }
};

vi.mock('twisted', () => ({
    RiotApi: vi.fn(),
    LolApi: vi.fn().mockImplementation(() => mockLolApi),
    TftApi: vi.fn().mockImplementation(() => mockTftApi)
}));

// Import after mocks are defined
import { getMatchHistory, getSummoner, getTftMatchDetails } from '../../services/riotService.js';

describe('riotService helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset methods to fresh fn to avoid cross-test calls accumulation
        mockLolApi.Summoner.getByPUUID = vi.fn();
        mockLolApi.MatchV5.list = vi.fn();
        mockLolApi.MatchV5.get = vi.fn();
        mockLolApi.League.byPUUID = vi.fn();
        mockTftApi.Match.list = vi.fn();
        mockTftApi.Match.get = vi.fn();
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

    it('unwraps TFT match details (success)', async () => {
        mockTftApi.Match.get.mockResolvedValue({ response: { info: { queue_id: 1100 } } });
        const res = await getTftMatchDetails('match-1', 'EUROPE' as any);
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ info: { queue_id: 1100 } });
    });
});
