import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import {
    createMockCommandInteraction,
    expectEditReplyContainsText,
    expectEditReplyHasEmbed,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import { Regions } from '../constants/riotRegions.js';
import type { LeagueMatchDto, LeagueMatchParticipantDto } from '../types/riotDtos.js';

const PLAYER_PUUID = 'player-puuid';

vi.mock('../../../services/riotService.js', () => ({
    getMatchHistory: vi.fn(),
    getMatchDetails: vi.fn(),
}));

vi.mock('../utils/leagueUtils.js', () => ({
    getLeagueIdentityFromInteraction: vi.fn(),
}));

vi.mock('../constants/riotRegions.js', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual, {
        regionToRegionGroupForAccountAPI: vi.fn().mockReturnValue('EUROPE'),
    });
});

describe('leagueForm command', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.RIOT_RECENT_FORM_MATCH_COUNT;
        delete process.env.RIOT_RECENT_FORM_TTL_MINUTES;
        const cache = await import('../recentForm/leagueRecentFormCache.js');
        cache.clearLeagueRecentFormCacheForTests();
    });

    it('fetches live matches, aggregates an embed, and caches the summary', async () => {
        await mockIdentity();
        await mockHistory(['match-1', 'match-2']);
        await mockDetails([
            match(participant({ win: true, championName: 'Lux', kills: 8, deaths: 2, assists: 10 })),
            match(participant({ win: false, championName: 'Ahri', kills: 4, deaths: 5, assists: 6 })),
        ]);

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        const { getMatchHistory, getMatchDetails } = await import('../../../services/riotService.js');
        expect(getMatchHistory).toHaveBeenCalledWith(PLAYER_PUUID, 'EUROPE', 0, 5);
        expect(getMatchDetails).toHaveBeenCalledTimes(2);
        expectEditReplyHasEmbed(interaction, {
            titleContains: 'League form for TestSummoner',
            descriptionContains: '1W-1L over 2 recent games',
            field: { nameEquals: 'Top champions', valueContains: 'Lux' },
        });
        expect(auditRecord).toHaveBeenNthCalledWith(1, expect.objectContaining({
            action: 'riot.leagueForm',
            targetType: 'riotRecentForm',
            targetId: 'EUW',
            metadata: expect.objectContaining({
                provider: 'riot',
                game: 'league',
                outcome: 'live_success',
                source: 'live',
                refreshRequested: false,
                cacheStatus: 'miss',
                summaryStatus: 'fresh',
                matchCount: 2,
                wins: 1,
                losses: 1,
            }),
        }));

        vi.mocked(getMatchHistory).mockClear();
        vi.mocked(getMatchDetails).mockClear();

        const cachedInteraction = createMockCommandInteraction();
        await command.execute(cachedInteraction as unknown as ChatInputCommandInteraction);

        expect(getMatchHistory).not.toHaveBeenCalled();
        expect(getMatchDetails).not.toHaveBeenCalled();
        expectEditReplyHasEmbed(cachedInteraction, {
            titleContains: 'League form for TestSummoner',
            descriptionContains: '1W-1L over 2 recent games',
        });
        expect(auditRecord).toHaveBeenNthCalledWith(2, expect.objectContaining({
            action: 'riot.leagueForm',
            metadata: expect.objectContaining({
                outcome: 'cache_hit',
                source: 'cache',
                refreshRequested: false,
                cacheStatus: 'hit',
                summaryStatus: 'fresh',
            }),
        }));

        const auditPayload = JSON.stringify(auditRecord.mock.calls);
        expect(auditPayload).not.toContain(PLAYER_PUUID);
        expect(auditPayload).not.toContain('match-1');
        expect(auditPayload).not.toContain('match-2');
    });

    it('bypasses the cache when refresh is requested', async () => {
        await mockIdentity();
        await mockHistory(['match-1']);
        await mockDetails([match(participant({ win: true, championName: 'Lux' }))]);

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        const { getMatchHistory, getMatchDetails } = await import('../../../services/riotService.js');
        vi.mocked(getMatchHistory).mockClear();
        vi.mocked(getMatchDetails).mockClear();
        await mockDetails([match(participant({ win: false, championName: 'Ahri' }))]);

        const refreshInteraction = createMockCommandInteraction({ booleanOptions: { refresh: true } });
        await command.execute(refreshInteraction as unknown as ChatInputCommandInteraction);

        expect(getMatchHistory).toHaveBeenCalledTimes(1);
        expect(getMatchDetails).toHaveBeenCalledTimes(1);
        expect(auditRecord).toHaveBeenNthCalledWith(2, expect.objectContaining({
            action: 'riot.leagueForm',
            metadata: expect.objectContaining({
                outcome: 'live_success',
                source: 'live',
                refreshRequested: true,
                cacheStatus: 'bypass',
            }),
        }));
    });

    it('handles missing identity information', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Missing summoner or region'));

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Please provide a Riot ID and region');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            targetType: 'riotRecentForm',
            severity: 'warn',
            metadata: expect.objectContaining({
                outcome: 'missing_identity',
                refreshRequested: false,
                cacheStatus: 'not_checked',
            }),
        }));
    });

    it('records Riot account lookup failures separately from missing input', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Failed to fetch PUUID by Riot ID: 429 Rate limited'));

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Riot account lookup is unavailable');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            targetType: 'riotRecentForm',
            severity: 'error',
            status: 'failure',
            metadata: expect.objectContaining({
                outcome: 'identity_failure',
                refreshRequested: false,
                cacheStatus: 'not_checked',
                errorCategory: 'rate_limited',
            }),
        }));
    });

    it('handles provider failures without caching an error snapshot', async () => {
        await mockIdentity();
        const { getMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getMatchHistory).mockResolvedValue({ success: false, error: 'Rate limit exceeded' });

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Failed to fetch League recent form: Rate limit exceeded');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'error',
            status: 'failure',
            metadata: expect.objectContaining({
                outcome: 'history_failure',
                refreshRequested: false,
                cacheStatus: 'miss',
                errorCategory: 'rate_limited',
            }),
        }));

        const cache = await import('../recentForm/leagueRecentFormCache.js');
        expect(cache.getCachedLeagueRecentForm(cache.getLeagueRecentFormCacheKey('EUW', PLAYER_PUUID))).toBeNull();
    });

    it('records empty history summaries without treating them as failures', async () => {
        await mockIdentity();
        await mockHistory([]);

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyHasEmbed(interaction, {
            titleContains: 'League form for TestSummoner',
            descriptionContains: 'No recent League matches found',
        });
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'info',
            status: 'success',
            metadata: expect.objectContaining({
                outcome: 'empty_history',
                source: 'live',
                refreshRequested: false,
                cacheStatus: 'miss',
                summaryStatus: 'empty_history',
                matchCount: 0,
                requestedMatchCount: 0,
            }),
        }));
    });

    it('records partial summaries when some match details fail', async () => {
        await mockIdentity();
        await mockHistory(['match-1', 'match-2']);
        await mockDetails([match(participant({ win: true, championName: 'Lux' }))]);

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyHasEmbed(interaction, {
            titleContains: 'League form for TestSummoner',
            descriptionContains: 'Partial summary',
        });
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'warn',
            status: 'success',
            metadata: expect.objectContaining({
                outcome: 'live_partial',
                source: 'live',
                refreshRequested: false,
                cacheStatus: 'miss',
                summaryStatus: 'partial',
                matchCount: 1,
                requestedMatchCount: 2,
                failedDetailCount: 1,
            }),
        }));
    });

    it('records malformed match history responses', async () => {
        await mockIdentity();
        const { getMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getMatchHistory).mockResolvedValue({ success: true, data: { unexpected: true } });

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'malformed match history');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'error',
            status: 'failure',
            metadata: expect.objectContaining({
                outcome: 'malformed_history',
                refreshRequested: false,
                cacheStatus: 'miss',
                errorCategory: 'malformed_data',
            }),
        }));
    });

    it('records total detail fetch failures without caching an error snapshot', async () => {
        await mockIdentity();
        await mockHistory(['match-1', 'match-2']);
        await mockDetails([]);

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Failed to fetch details for recent League matches');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'error',
            status: 'failure',
            metadata: expect.objectContaining({
                outcome: 'detail_failure',
                refreshRequested: false,
                cacheStatus: 'miss',
                requestedMatchCount: 2,
                failedDetailCount: 2,
                errorCategory: 'provider_error',
            }),
        }));

        const cache = await import('../recentForm/leagueRecentFormCache.js');
        expect(cache.getCachedLeagueRecentForm(cache.getLeagueRecentFormCacheKey('EUW', PLAYER_PUUID))).toBeNull();
    });

    it('records unsupported Riot regions before provider calls', async () => {
        await mockIdentity();
        const { regionToRegionGroupForAccountAPI } = await import('../constants/riotRegions.js');
        vi.mocked(regionToRegionGroupForAccountAPI).mockImplementationOnce(() => {
            throw new Error('Unsupported region');
        });

        const { auditRecord, command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        const { getMatchHistory, getMatchDetails } = await import('../../../services/riotService.js');
        expect(getMatchHistory).not.toHaveBeenCalled();
        expect(getMatchDetails).not.toHaveBeenCalled();
        expectEditReplyContainsText(interaction, 'Unsupported Riot region');
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'riot.leagueForm',
            severity: 'warn',
            status: 'failure',
            metadata: expect.objectContaining({
                outcome: 'unsupported_region',
                refreshRequested: false,
                cacheStatus: 'miss',
                region: 'EUW',
            }),
        }));
    });

    it('stores only aggregate snapshot data in cache', async () => {
        await mockIdentity();
        await mockHistory(['match-1']);
        await mockDetails([match(participant({ win: true, championName: 'Lux' }))]);

        const { command, interaction } = await setupLeagueFormCommand();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        const cache = await import('../recentForm/leagueRecentFormCache.js');
        const snapshot = cache.getCachedLeagueRecentForm(cache.getLeagueRecentFormCacheKey('EUW', PLAYER_PUUID));
        const serialized = JSON.stringify(snapshot);

        expect(snapshot).not.toBeNull();
        expect(serialized).toContain('Lux');
        expect(serialized).not.toContain('match-1');
        expect(serialized).not.toContain(PLAYER_PUUID);
        expect(serialized).not.toContain('participants');
    });
});

async function setupLeagueFormCommand() {
    const auditRecord = vi.fn(async () => undefined);
    const context = await setupCommandTest('modules/league/commands/leagueForm.js', {
        managerOverrides: {
            auditEventManager: {
                record: auditRecord,
            },
        },
    });
    return { ...context, auditRecord };
}

async function mockIdentity(): Promise<void> {
    const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
    vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
        summoner: 'TestSummoner',
        region: 'EUW' as Regions,
        puuid: PLAYER_PUUID,
    });
}

async function mockHistory(matchIds: string[]): Promise<void> {
    const { getMatchHistory } = await import('../../../services/riotService.js');
    vi.mocked(getMatchHistory).mockResolvedValue({
        success: true,
        data: matchIds,
    });
}

async function mockDetails(matches: LeagueMatchDto[]): Promise<void> {
    const { getMatchDetails } = await import('../../../services/riotService.js');
    vi.mocked(getMatchDetails).mockImplementation(async () => {
        const next = matches.shift();
        return next
            ? { success: true, data: next }
            : { success: false, error: 'Missing mock match' };
    });
}

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

function match(player: LeagueMatchParticipantDto): LeagueMatchDto {
    return {
        info: {
            participants: [player],
            gameMode: 'CLASSIC',
            queueId: 420,
            gameEndTimestamp: 1000,
            gameDuration: player.timePlayed * 1000,
        },
    };
}
