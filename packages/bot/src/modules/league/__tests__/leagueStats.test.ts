// filepath: f:\Coding\discord-bot\packages\bot\src\modules\league\__tests__\leagueStats.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
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

        // Mock the editReply function to capture what's being sent
        const editReplySpy = vi.fn();

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {
                interaction: {
                    deferReply: vi.fn().mockResolvedValue(undefined),
                    editReply: editReplySpy
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLeagueIdentityFromInteraction was called
        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);

        // Verify getSummoner was called with correct parameters
        expect(getSummoner).toHaveBeenCalledWith('test-puuid-12345', 'EUW');

        // Verify getSummonerDetails was called with correct parameters
        expect(getSummonerDetails).toHaveBeenCalledWith('test-puuid-12345', 'EUW');

        // Verify editReply was called (instead of checking EmbedBuilder directly)
        expect(editReplySpy).toHaveBeenCalled();

        // Verify that an object with embeds was passed to editReply
        const callArg = editReplySpy.mock.calls[0][0];
        expect(callArg).toBeDefined();
        expect(typeof callArg).toBe('object');
        expect(Array.isArray(callArg.embeds)).toBe(true);
        expect(callArg.embeds.length).toBeGreaterThan(0);
    });

    it('handles missing identity information', async () => {
        // Mock getLeagueIdentityFromInteraction to throw an error
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Missing summoner or region'));

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {
                interaction: {
                    deferReply: vi.fn().mockResolvedValue(undefined),
                    editReply: vi.fn().mockResolvedValue(undefined)
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify error response
        expect(interaction.editReply).toHaveBeenCalledWith(
            'Please provide a Riot ID and region, or link your account first.'
        );
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

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueStats.js',
            {
                interaction: {
                    deferReply: vi.fn().mockResolvedValue(undefined),
                    editReply: vi.fn().mockResolvedValue(undefined)
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify error response now uses an embed object
        expect(interaction.editReply).toHaveBeenCalled();
        const arg = (interaction.editReply as any).mock.calls[0][0];
        expect(typeof arg).toBe('object');
        expect(Array.isArray(arg.embeds)).toBe(true);
        const desc = arg.embeds?.[0]?.data?.description ?? arg.embeds?.[0]?.description ?? '';
        expect(String(desc)).toContain('Failed to fetch summoner: Rate limit exceeded');
    });
});
