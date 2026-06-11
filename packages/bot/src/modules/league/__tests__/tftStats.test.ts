import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectEditReplyContainsText, expectEditReplyHasEmbed } from '@zeffuro/fakegaming-common/testing';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Regions } from '../constants/riotRegions.js';

vi.mock('../../../services/riotService.js', () => ({
    getTftSummoner: vi.fn(),
    getTftLeagueEntries: vi.fn()
}));

vi.mock('../utils/leagueUtils.js', () => ({
    getLeagueIdentityFromInteraction: vi.fn()
}));

describe('tftStats command', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('displays TFT ranked stats successfully', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'Tactician#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        const { getTftSummoner, getTftLeagueEntries } = await import('../../../services/riotService.js');
        vi.mocked(getTftSummoner).mockResolvedValue({
            success: true,
            data: {
                profileIconId: 456,
                summonerLevel: 42
            }
        });
        vi.mocked(getTftLeagueEntries).mockResolvedValue({
            success: true,
            data: [
                {
                    queueType: 'RANKED_TFT',
                    tier: 'DIAMOND',
                    rank: 'I',
                    leaguePoints: 88,
                    wins: 22,
                    losses: 11
                }
            ]
        });

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);
        expect(getTftSummoner).toHaveBeenCalledWith('test-puuid-12345', 'EUW');
        expect(getTftLeagueEntries).toHaveBeenCalledWith('test-puuid-12345', 'EUW');
        expectEditReplyHasEmbed(interaction);
    });

    it('handles missing identity information', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Missing summoner or region'));

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Please provide a Riot ID and region');
    });

    it('handles failure to fetch the TFT summoner', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'Tactician#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        const { getTftSummoner } = await import('../../../services/riotService.js');
        vi.mocked(getTftSummoner).mockResolvedValue({
            success: false,
            error: 'Rate limited'
        });

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Failed to fetch TFT summoner: Rate limited');
    });

    it('handles failure to fetch TFT ranked stats', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'Tactician#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        const { getTftSummoner, getTftLeagueEntries } = await import('../../../services/riotService.js');
        vi.mocked(getTftSummoner).mockResolvedValue({
            success: true,
            data: {
                profileIconId: 456,
                summonerLevel: 42
            }
        });
        vi.mocked(getTftLeagueEntries).mockResolvedValue({
            success: false,
            error: 'Unavailable'
        });

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'Failed to fetch TFT ranked stats: Unavailable');
    });

    it('shows an unranked field when TFT ranked entries are empty', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'Tactician#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        const { getTftSummoner, getTftLeagueEntries } = await import('../../../services/riotService.js');
        vi.mocked(getTftSummoner).mockResolvedValue({
            success: true,
            data: {}
        });
        vi.mocked(getTftLeagueEntries).mockResolvedValue({
            success: true,
            data: []
        });

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyHasEmbed(interaction, {
            field: {
                nameEquals: 'Ranked',
                valueContains: 'No TFT ranked data found.'
            }
        });
    });

    it('uses sensible defaults for sparse TFT ranked entries', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'Tactician#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        const { getTftSummoner, getTftLeagueEntries } = await import('../../../services/riotService.js');
        vi.mocked(getTftSummoner).mockResolvedValue({
            success: true,
            data: {}
        });
        vi.mocked(getTftLeagueEntries).mockResolvedValue({
            success: true,
            data: [{}]
        });

        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftStats.js',
            {}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyHasEmbed(interaction, {
            field: {
                nameEquals: 'TFT Ranked',
                valueContains: '**Unranked **'
            }
        });
    });
});
