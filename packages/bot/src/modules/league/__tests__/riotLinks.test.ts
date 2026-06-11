import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';

vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn(),
}));

describe('riot-links command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists linked Riot accounts for admins', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        const getLinkedAccountsPlain = vi.fn().mockResolvedValue([
            {
                discordId: 'user-1',
                summonerName: 'Player#EUW',
                region: 'euw1',
                puuid: 'puuid-1',
            },
        ]);

        const { command, interaction } = await setupCommandTest('modules/league/commands/riotLinks.js', {
            interaction: { subcommand: 'list' },
            managerOverrides: {
                leagueManager: { getLinkedAccountsPlain },
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(requireAdmin).toHaveBeenCalledWith(interaction);
        expect(getLinkedAccountsPlain).toHaveBeenCalled();
        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Player#EUW'));
    });

    it('shows a linked Riot account for a user', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        const getLinkedAccountPlain = vi.fn().mockResolvedValue({
            discordId: 'target-user',
            summonerName: 'Target#NA1',
            region: 'na1',
            puuid: '1234567890abcdef1234567890abcdef',
        });

        const { command, interaction } = await setupCommandTest('modules/league/commands/riotLinks.js', {
            interaction: {
                subcommand: 'show',
                userOptions: { user: 'target-user' },
            },
            managerOverrides: {
                leagueManager: { getLinkedAccountPlain },
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getLinkedAccountPlain).toHaveBeenCalledWith('target-user');
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Target#NA1'));
    });

    it('unlinks a Riot account for a user', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(true);

        const getLinkedAccountPlain = vi.fn().mockResolvedValue({
            discordId: 'target-user',
            summonerName: 'Target#NA1',
            region: 'na1',
            puuid: 'puuid-1',
        });
        const removeLinkedAccount = vi.fn().mockResolvedValue(1);

        const { command, interaction } = await setupCommandTest('modules/league/commands/riotLinks.js', {
            interaction: {
                subcommand: 'unlink',
                userOptions: { user: 'target-user' },
            },
            managerOverrides: {
                leagueManager: { getLinkedAccountPlain, removeLinkedAccount },
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(removeLinkedAccount).toHaveBeenCalledWith('target-user');
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Removed linked Riot account'));
    });

    it('does nothing else when the user is not an admin', async () => {
        const { requireAdmin } = await import('../../../utils/permissions.js');
        vi.mocked(requireAdmin).mockResolvedValue(false);

        const getLinkedAccountsPlain = vi.fn();
        const { command, interaction } = await setupCommandTest('modules/league/commands/riotLinks.js', {
            interaction: { subcommand: 'list' },
            managerOverrides: {
                leagueManager: { getLinkedAccountsPlain },
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(getLinkedAccountsPlain).not.toHaveBeenCalled();
    });
});
