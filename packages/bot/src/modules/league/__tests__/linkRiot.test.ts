import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {
    expectEditReplyContainsText,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import {Regions} from '../constants/riotRegions.js';

vi.mock('../../../services/riotService.js', () => ({
    resolveLeagueIdentity: vi.fn(),
}));

const mockGetRegionCodeFromName = vi.fn((regionInput: string | undefined) => {
    if (regionInput === 'EU_WEST') return 'EUW';
    if (regionInput === 'AMERICA_NORTH') return 'NA';
    return regionInput;
});

vi.mock('../utils/leagueUtils.js', () => ({
    getRegionCodeFromName: mockGetRegionCodeFromName,
}));

describe('linkRiot command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRegionCodeFromName.mockImplementation((regionInput: string | undefined) => {
            if (regionInput === 'EU_WEST') return 'EUW';
            if (regionInput === 'AMERICA_NORTH') return 'NA';
            return regionInput;
        });
    });

    it('links the caller through the League manager', async () => {
        const {resolveLeagueIdentity} = await import('../../../services/riotService.js');
        vi.mocked(resolveLeagueIdentity).mockResolvedValue({
            summoner: 'TestSummoner#EUW',
            region: 'EUW' as Regions,
            puuid: 'test-puuid-12345',
        });
        const setLinkedAccount = vi.fn(async () => undefined);

        const {command, interaction} = await setupCommandTest('modules/league/commands/linkRiot.js', {
            interaction: {
                stringOptions: {'riot-id': 'TestSummoner#EUW', region: 'EU_WEST'},
                user: {id: '123456789012345678'},
            },
            managerOverrides: {
                leagueManager: {setLinkedAccount},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(resolveLeagueIdentity).toHaveBeenCalledWith({
            summoner: 'TestSummoner#EUW',
            region: 'EUW',
            userId: '123456789012345678',
        });
        expect(setLinkedAccount).toHaveBeenCalledWith({
            discordId: '123456789012345678',
            summonerName: 'TestSummoner#EUW',
            region: 'EUW',
            puuid: 'test-puuid-12345',
        });
        expectEditReplyContainsText(interaction, 'Linked <@123456789012345678> to Riot ID: TestSummoner#EUW [EUW]');
    });

    it('allows admins to link another user', async () => {
        const {resolveLeagueIdentity} = await import('../../../services/riotService.js');
        vi.mocked(resolveLeagueIdentity).mockResolvedValue({
            summoner: 'OtherPlayer#NA1',
            region: 'NA' as Regions,
            puuid: 'target-puuid',
        });
        const setLinkedAccount = vi.fn(async () => undefined);

        const {command, interaction} = await setupCommandTest('modules/league/commands/linkRiot.js', {
            interaction: {
                stringOptions: {'riot-id': 'OtherPlayer#NA1', region: 'AMERICA_NORTH'},
                userOptions: {user: '987654321098765432'},
                user: {id: '123456789012345678'},
                memberPermissions: {has: vi.fn(() => true)},
            },
            managerOverrides: {
                leagueManager: {setLinkedAccount},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(resolveLeagueIdentity).toHaveBeenCalledWith({
            summoner: 'OtherPlayer#NA1',
            region: 'NA',
            userId: '987654321098765432',
        });
        expect(setLinkedAccount).toHaveBeenCalledWith({
            discordId: '987654321098765432',
            summonerName: 'OtherPlayer#NA1',
            region: 'NA',
            puuid: 'target-puuid',
        });
        expectEditReplyContainsText(interaction, 'Linked <@987654321098765432> to Riot ID: OtherPlayer#NA1 [NA]');
    });

    it('blocks non-admins from linking other users', async () => {
        const {resolveLeagueIdentity} = await import('../../../services/riotService.js');
        const setLinkedAccount = vi.fn(async () => undefined);

        const {command, interaction} = await setupCommandTest('modules/league/commands/linkRiot.js', {
            interaction: {
                userOptions: {user: '987654321098765432'},
                user: {id: '123456789012345678'},
                memberPermissions: {has: vi.fn(() => false)},
            },
            managerOverrides: {
                leagueManager: {setLinkedAccount},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(interaction, 'You need admin permissions to link for another user.');
        expect(resolveLeagueIdentity).not.toHaveBeenCalled();
        expect(setLinkedAccount).not.toHaveBeenCalled();
    });

    it('handles errors when resolving league identity', async () => {
        const {resolveLeagueIdentity} = await import('../../../services/riotService.js');
        vi.mocked(resolveLeagueIdentity).mockRejectedValue(new Error('Invalid Riot ID or region'));
        const setLinkedAccount = vi.fn(async () => undefined);

        const {command, interaction} = await setupCommandTest('modules/league/commands/linkRiot.js', {
            interaction: {
                stringOptions: {'riot-id': 'InvalidSummoner#INVALID'},
                user: {id: '123456789012345678'},
            },
            managerOverrides: {
                leagueManager: {setLinkedAccount},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectEditReplyContainsText(
            interaction,
            'Failed to resolve Riot Account. Please check the Riot ID and region.'
        );
        expect(setLinkedAccount).not.toHaveBeenCalled();
    });
});
