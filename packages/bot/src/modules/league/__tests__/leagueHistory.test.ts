// filepath: f:\Coding\discord-bot\packages\bot\src\modules\league\__tests__\leagueHistory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';
import { ChatInputCommandInteraction } from 'discord.js';
// Import the type only to satisfy ESLint
import type { AttachmentBuilder } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';

// Dummy type usage to satisfy ESLint
type _TestType = AttachmentBuilder;

// Mock the riotService module
vi.mock('../../../services/riotService.js', () => ({
    getMatchHistory: vi.fn(),
    getMatchDetails: vi.fn()
}));

// Mock the leagueUtils module
vi.mock('../utils/leagueUtils.js', () => ({
    getLeagueIdentityFromInteraction: vi.fn()
}));

// Mock the image generation function
vi.mock('../image/leagueHistoryImage.js', () => ({
    generateLeagueHistoryImage: vi.fn(() => Promise.resolve(Buffer.from('fake-image-data')))
}));

// Mock the twisted library's regionToRegionGroupForAccountAPI function
vi.mock('twisted/dist/constants/regions.js', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual, {
        regionToRegionGroupForAccountAPI: vi.fn().mockReturnValue('EUROPE')
    });
});

// Mock AttachmentBuilder
vi.mock('discord.js', async (importOriginal) => {
    const actual = await importOriginal();
    return Object.assign({}, actual, {
        AttachmentBuilder: vi.fn().mockImplementation(() => ({
            name: 'league-history.png'
        }))
    });
});

describe('leagueHistory command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('displays match history successfully', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getMatchHistory to return match IDs
        const { getMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getMatchHistory).mockResolvedValue({
            success: true,
            data: ['match-1', 'match-2', 'match-3']
        });

        // Mock getMatchDetails to return match data
        const { getMatchDetails } = await import('../../../services/riotService.js');
        const mockMatchData = {
            info: {
                gameMode: 'CLASSIC',
                participants: []
            }
        };
        vi.mocked(getMatchDetails).mockResolvedValue({
            success: true,
            data: mockMatchData
        });

        // Import and mock generateLeagueHistoryImage
        const { generateLeagueHistoryImage } = await import('../image/leagueHistoryImage.js');
        vi.mocked(generateLeagueHistoryImage).mockResolvedValue(Buffer.from('fake-image-data'));

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueHistory.js',
            {
                interaction: {
                    deferReply: vi.fn().mockResolvedValue(undefined),
                    editReply: vi.fn().mockResolvedValue(undefined)
                }
            }
        );

        // Execute the command
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLeagueIdentityFromInteraction was called
        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);

        // Verify regionToRegionGroupForAccountAPI was called with the region
        const { regionToRegionGroupForAccountAPI } = await import('twisted/dist/constants/regions.js');
        expect(regionToRegionGroupForAccountAPI).toHaveBeenCalledWith('EUW');

        // Verify getMatchHistory was called with the correct parameters
        expect(getMatchHistory).toHaveBeenCalledWith('test-puuid-12345', 'EUROPE', 0, 5);

        // Verify getMatchDetails was called for each match ID
        expect(getMatchDetails).toHaveBeenCalledTimes(3);
        expect(getMatchDetails).toHaveBeenCalledWith('match-1', 'EUROPE');
        expect(getMatchDetails).toHaveBeenCalledWith('match-2', 'EUROPE');
        expect(getMatchDetails).toHaveBeenCalledWith('match-3', 'EUROPE');

        // Verify generateLeagueHistoryImage was called with the matches and identity
        expect(generateLeagueHistoryImage).toHaveBeenCalledWith(
            [mockMatchData, mockMatchData, mockMatchData],
            {
                summoner: 'TestSummoner',
                region: 'EUW',
                puuid: 'test-puuid-12345'
            }
        );

        // Verify the response with the image attachment
        expect(interaction.editReply).toHaveBeenCalled();
    });

    it('handles missing identity information', async () => {
        // Mock getLeagueIdentityFromInteraction to throw an error
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(
            new Error('Missing summoner or region')
        );

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueHistory.js',
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
            'Please provide a summoner name and region, or link your account first.'
        );
    });

    it('handles failure to fetch match history', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getMatchHistory to return an error
        const { getMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getMatchHistory).mockResolvedValue({
            success: false,
            error: 'Rate limit exceeded'
        });

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/leagueHistory.js',
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
            'Failed to fetch match history: Rate limit exceeded'
        );
    });
});
