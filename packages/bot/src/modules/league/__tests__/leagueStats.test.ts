import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest, expectEditReplyContainsText, expectEditReplyHasEmbed } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';

// Mock the riotService module
vi.mock('../../../services/riotService.js', () => ({
    getSummoner: vi.fn(),
    getSummonerDetails: vi.fn()
}));

// Mock the leagueUtils module
vi.mock('../utils/leagueUtils.js', () => ({
    getLeagueIdentityFromInteraction: vi.fn()
}));

describe('leagueStats command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('displays league stats successfully', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getSummoner to return valid summoner data
        const { getSummoner } = await import('../../../services/riotService.js');
        vi.mocked(getSummoner).mockResolvedValue({
            success: true,
            data: {
                profileIconId: 123,
                summonerLevel: 150
            }
        });

        // Mock getSummonerDetails to return valid ranked data
        const { getSummonerDetails } = await import('../../../services/riotService.js');
        const rankedEntries = [
            {
                queueType: 'RANKED_SOLO_5x5',
                tier: 'DIAMOND',
                rank: 'II',
                leaguePoints: 75,
                wins: 120,
                losses: 100
            },
            {
                queueType: 'RANKED_FLEX_SR',
                tier: 'PLATINUM',
                rank: 'III',
                leaguePoints: 35,
                wins: 55,
                losses: 45
            }
        ];
        vi.mocked(getSummonerDetails).mockResolvedValue({
            success: true,
            data: rankedEntries
        });

        // Setup the test environment with default interaction
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {}
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLeagueIdentityFromInteraction was called
        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);

        // Verify getSummoner was called with correct parameters
        expect(getSummoner).toHaveBeenCalledWith('test-puuid-12345', 'EUW');

        // Verify getSummonerDetails was called with correct parameters
        expect(getSummonerDetails).toHaveBeenCalledWith('test-puuid-12345', 'EUW');

        // Verify editReply was called with embeds payload
        expectEditReplyHasEmbed(interaction);
    });

    it('handles missing identity information', async () => {
        // Mock getLeagueIdentityFromInteraction to throw an error
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Missing summoner or region'));

        // Setup the test environment with default interaction
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {}
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify error response
        expectEditReplyContainsText(interaction, 'Please provide a Riot ID and region');
    });

    it('handles failure to fetch summoner data', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getSummoner to return an error
        const { getSummoner } = await import('../../../services/riotService.js');
        vi.mocked(getSummoner).mockResolvedValue({
            success: false,
            error: 'Rate limit exceeded'
        });

        // Setup the test environment with default interaction
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {}
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify error response now uses an embed object
        expectEditReplyContainsText(interaction, 'Failed to fetch summoner: Rate limit exceeded');
    });
});
