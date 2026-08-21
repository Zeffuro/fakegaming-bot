import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { setupCommandTest } from '@zeffuro/fakegaming-common/testing';

const runtime = vi.hoisted(() => ({
    configure: vi.fn(),
    disable: vi.fn(),
    getStatus: vi.fn(),
}));

vi.mock('../shared/voiceChannelOccupancyRuntime.js', () => ({
    voiceChannelOccupancyRuntime: runtime,
}));

describe('occupy-channel command', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('configures a ready muted/deafened occupancy target for administrators', async () => {
        runtime.configure.mockResolvedValue({ state: 'ready' });
        const getForGuild = vi.fn().mockResolvedValue(null);
        const setForGuild = vi.fn().mockResolvedValue({ guildId: 'guild-1', channelId: 'voice-1' });
        const client = { user: { id: 'bot-1' } };
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: { getForGuild, setForGuild },
                },
                interaction: {
                    client,
                    guildId: 'guild-1',
                    subcommand: 'enable',
                    channelOptions: { channel: 'voice-1' },
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(runtime.configure).toHaveBeenCalledWith(client, { guildId: 'guild-1', channelId: 'voice-1' });
        expect(setForGuild).toHaveBeenCalledWith('guild-1', 'voice-1');
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('occupying <#voice-1>'));
        const json = command.data.toJSON();
        expect(json.default_member_permissions).toBe(PermissionFlagsBits.Administrator.toString());
        expect(json.dm_permission).toBe(false);
    });

    it('does not persist a target that lacks required channel permissions', async () => {
        runtime.configure.mockResolvedValue({ state: 'failed', code: 'missing-permissions' });
        const setForGuild = vi.fn();
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: {
                        getForGuild: vi.fn().mockResolvedValue(null),
                        setForGuild,
                    },
                },
                interaction: {
                    client: {},
                    guildId: 'guild-1',
                    subcommand: 'enable',
                    channelOptions: { channel: 'voice-1' },
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(setForGuild).not.toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('View Channel and Connect'));
    });

    it('removes the persisted target and leaves voice when disabled', async () => {
        const disableForGuild = vi.fn().mockResolvedValue(true);
        runtime.disable.mockResolvedValue(undefined);
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: { disableForGuild },
                },
                interaction: {
                    guildId: 'guild-1',
                    subcommand: 'disable',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(disableForGuild).toHaveBeenCalledWith('guild-1');
        expect(runtime.disable).toHaveBeenCalledWith('guild-1');
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('has left the channel'),
        }));
    });

    it('reports a disconnected configured channel in Dutch', async () => {
        runtime.getStatus.mockReturnValue('disconnected');
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    guildLocaleConfigManager: { getOutputLocale: vi.fn().mockResolvedValue('nl') },
                    voiceChannelOccupancyConfigManager: {
                        getForGuild: vi.fn().mockResolvedValue({ guildId: 'guild-1', channelId: 'voice-1' }),
                    },
                },
                interaction: {
                    guildId: 'guild-1',
                    subcommand: 'status',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('niet verbonden'),
        }));
    });

    it('reports when occupancy is disabled', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: { getForGuild: vi.fn().mockResolvedValue(null) },
                },
                interaction: {
                    guildId: 'guild-1',
                    subcommand: 'status',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('occupancy is disabled'),
        }));
    });

    it.each([
        ['ready', 'active in'],
        ['connecting', 'connecting or retrying'],
    ])('reports the %s connection state', async (state, expectedText) => {
        runtime.getStatus.mockReturnValue(state);
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: {
                        getForGuild: vi.fn().mockResolvedValue({ guildId: 'guild-1', channelId: 'voice-1' }),
                    },
                },
                interaction: {
                    guildId: 'guild-1',
                    subcommand: 'status',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining(expectedText),
        }));
    });

    it('reports an already disabled configuration', async () => {
        runtime.disable.mockResolvedValue(undefined);
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: {
                        disableForGuild: vi.fn().mockResolvedValue(false),
                    },
                },
                interaction: {
                    guildId: 'guild-1',
                    subcommand: 'disable',
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('was already disabled'),
        }));
    });

    it('persists a target while its connection is retrying', async () => {
        runtime.configure.mockResolvedValue({ state: 'retrying' });
        const setForGuild = vi.fn().mockResolvedValue({ guildId: 'guild-1', channelId: 'voice-1' });
        const { command, interaction } = await setupCommandTest(
            'modules/general/commands/occupyChannel.js',
            {
                managerOverrides: {
                    voiceChannelOccupancyConfigManager: {
                        getForGuild: vi.fn().mockResolvedValue(null),
                        setForGuild,
                    },
                },
                interaction: {
                    client: {},
                    guildId: 'guild-1',
                    subcommand: 'enable',
                    channelOptions: { channel: 'voice-1' },
                    memberPermissions: { has: vi.fn().mockReturnValue(true) },
                },
            },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(setForGuild).toHaveBeenCalledOnce();
        expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('still retrying'));
    });
});
