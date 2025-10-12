import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { Regions } from 'twisted/dist/constants/regions.js';
import { makeHistoryTestHelpers } from './helpers/historyTestHelpers.js';

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

    const H = makeHistoryTestHelpers({
        commandPath: 'modules/league/commands/leagueHistory.js',
        attachmentName: 'league-history.png',
        serviceKeys: { history: 'getMatchHistory', details: 'getMatchDetails' }
    });

    it('displays match history successfully', async () => {
        await H.mockIdentity('EUW' as Regions, 'test-puuid-12345', 'TestSummoner');
        await H.mockHistory(['match-1', 'match-2', 'match-3']);
        await H.mockDetails({ info: { gameMode: 'CLASSIC', participants: [] } });

        // Import and ensure generateLeagueHistoryImage resolves
        const { generateLeagueHistoryImage } = await import('../image/leagueHistoryImage.js');
        vi.mocked(generateLeagueHistoryImage).mockResolvedValue(Buffer.from('fake-image-data'));

        const { command, interaction } = await H.setupCmd();

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        // Verify getLeagueIdentityFromInteraction was called
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        expect(getLeagueIdentityFromInteraction).toHaveBeenCalledWith(interaction);

        // Verify regionToRegionGroupForAccountAPI was called with the region
        const { regionToRegionGroupForAccountAPI } = await import('twisted/dist/constants/regions.js');
        expect(regionToRegionGroupForAccountAPI).toHaveBeenCalledWith('EUW');

        // Verify service calls
        const { getMatchHistory, getMatchDetails } = await import('../../../services/riotService.js');
        expect(getMatchHistory).toHaveBeenCalledWith('test-puuid-12345', 'EUROPE', 0, 5);
        expect(getMatchDetails).toHaveBeenCalledTimes(3);
        expect(getMatchDetails).toHaveBeenCalledWith('match-1', 'EUROPE');
        expect(getMatchDetails).toHaveBeenCalledWith('match-2', 'EUROPE');
        expect(getMatchDetails).toHaveBeenCalledWith('match-3', 'EUROPE');

        // Verify the response with the image attachment
        H.expectAttachment(interaction, 'Recent League matches for');
    });

    it('handles missing identity information', async () => {
        const { getLeagueIdentityFromInteraction } = await import('../utils/leagueUtils.js');
        vi.mocked(getLeagueIdentityFromInteraction).mockRejectedValue(new Error('Missing summoner or region'));

        const { command, interaction } = await H.setupCmd();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        H.expectErrorText(interaction, 'Please provide a summoner name and region');
    });

    it('handles failure to fetch match history', async () => {
        await H.mockIdentity('EUW' as Regions, 'test-puuid-12345', 'TestSummoner');
        await H.mockHistory({ success: false, error: 'Rate limit exceeded' } as any);

        const { command, interaction } = await H.setupCmd();
        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        H.expectErrorText(interaction, 'Failed to fetch match history');
    });
});
