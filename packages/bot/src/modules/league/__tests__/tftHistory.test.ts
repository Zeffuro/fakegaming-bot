import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';
import { makeHistoryTestHelpers } from './helpers/historyTestHelpers.js';

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

    const H = makeHistoryTestHelpers({
        commandPath: 'modules/league/commands/tftHistory.js',
        attachmentName: 'tft-history.png',
        serviceKeys: { history: 'getTftMatchHistory', details: 'getTftMatchDetails' }
    });

    it('displays TFT match history successfully', async () => {
        await H.mockIdentity('EUW' as Regions, 'test-puuid-12345', 'TestSummoner');
        await H.mockHistory(['tft-match-1', 'tft-match-2', 'tft-match-3']);
        await H.mockDetails({ info: { tft_game_type: 'standard', participants: [] } });

        // Import and ensure generateTftHistoryImage resolves
        const { generateTftHistoryImage } = await import('../image/tftHistoryImage.js');
        vi.mocked(generateTftHistoryImage).mockResolvedValue(Buffer.from('fake-tft-image-data'));

        const { command, interaction } = await H.setupCmd();

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLeagueIdentityFromInteraction was called
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);

        // Verify regionToRegionGroupForAccountAPI was called with the region
        const { regionToRegionGroupForAccountAPI } = await import('twisted/dist/constants/regions.js');
        expect(regionToRegionGroupForAccountAPI).toHaveBeenCalledWith('EUW');

        // Verify service calls
        const { getTftMatchHistory, getTftMatchDetails } = await import('../../../services/riotService.js');
        expect(getTftMatchHistory).toHaveBeenCalledWith('test-puuid-12345', 'EUROPE', 0, 5);
        expect(getTftMatchDetails).toHaveBeenCalledTimes(3);
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-1', 'EUROPE');
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-2', 'EUROPE');
        expect(getTftMatchDetails).toHaveBeenCalledWith('tft-match-3', 'EUROPE');

        // Verify the response with the image attachment and content
        H.expectAttachment(interaction, 'Recent TFT matches for');
    });

    it('handles missing identity information', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(
            new Error('Missing summoner or region')
        );

        const { command, interaction } = await H.setupCmd();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        H.expectErrorText(interaction, 'Please provide a summoner name and region');
    });

    it('handles failure to fetch TFT match history', async () => {
        await H.mockIdentity('EUW' as Regions, 'test-puuid-12345', 'TestSummoner');
        await H.mockHistory({ success: false, error: 'Rate limit exceeded' } as any);

        const { command, interaction } = await H.setupCmd();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        H.expectErrorText(interaction, 'Failed to fetch TFT match history');
    });
});
