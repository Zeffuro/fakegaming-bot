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
    getTftMatchHistory: vi.fn(),
    getTftMatchDetails: vi.fn()
}));

// Mock the leagueUtils module
vi.mock('../utils/leagueUtils.js', () => ({
    getLeagueIdentityFromInteraction: vi.fn()
}));

// Mock the image generation function
vi.mock('../image/tftHistoryImage.js', () => ({
    generateTftHistoryImage: vi.fn(() => Promise.resolve(Buffer.from('fake-tft-image-data')))
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
            name: 'tft-history.png'
        }))
    });
});

describe('tftHistory command', () => {
    beforeEach(() => {
        // Reset all mocks and clear module cache before each test
        vi.resetAllMocks();
        vi.resetModules();
    });

    it('displays TFT match history successfully', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getTftMatchHistory to return match IDs
        const { getTftMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getTftMatchHistory).mockResolvedValue({
            success: true,
            data: ['tft-match-1', 'tft-match-2', 'tft-match-3']
        });

        // Mock getTftMatchDetails to return match data
        const { getTftMatchDetails } = await import('../../../services/riotService.js');
        const mockMatchData = {
            info: {
                tft_game_type: 'standard',
                participants: []
            }
        };
        vi.mocked(getTftMatchDetails).mockResolvedValue({
            success: true,
            data: mockMatchData
        });

        // Import and mock generateTftHistoryImage
        const { generateTftHistoryImage } = await import('../image/tftHistoryImage.js');
        vi.mocked(generateTftHistoryImage).mockResolvedValue(Buffer.from('fake-tft-image-data'));

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftHistory.js',
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

        // Verify getTftMatchHistory was called with the correct parameters
        expect(getTftMatchHistory).toHaveBeenCalledWith('test-puuid-12345', 'EUROPE', 0, 5);

        // Verify getTftMatchDetails was called for each match ID
        expect(getTftMatchDetails).toHaveBeenCalledTimes(3);
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-1', 'EUROPE');
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-2', 'EUROPE');
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-3', 'EUROPE');

        // Verify generateTftHistoryImage was called with the matches and identity
        expect(generateTftHistoryImage).toHaveBeenCalledWith(
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
            'modules/league/commands/tftHistory.js',
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

    it('handles failure to fetch TFT match history', async () => {
        // Mock getLeagueIdentityFromInteraction to return a valid identity
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockResolvedValue({
            summoner: 'TestSummoner',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345'
        });

        // Mock getTftMatchHistory to return an error
        const { getTftMatchHistory } = await import('../../../services/riotService.js');
        vi.mocked(getTftMatchHistory).mockResolvedValue({
            success: false,
            error: 'Rate limit exceeded'
        });

        // Setup the test environment
        const { command, interaction } = await setupCommandTest(
            'modules/league/commands/tftHistory.js',
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
            'Failed to fetch TFT match history: Rate limit exceeded'
        );
    });
});
