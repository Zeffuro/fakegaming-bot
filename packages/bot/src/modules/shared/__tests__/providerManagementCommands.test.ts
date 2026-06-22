import {ChatInputCommandInteraction} from 'discord.js';
import {describe, expect, it, vi} from 'vitest';
import {
    expectEphemeralReply,
    expectReplyTextContains,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';

const GUILD_ID = '987654321098765432';
const CHANNEL_ID = '123456789012345678';

async function setupProviderCommand(commandPath: string, managerOverrides: Record<string, Record<string, ReturnType<typeof vi.fn>>>) {
    return setupCommandTest(commandPath, {
        interaction: {
            guildId: GUILD_ID,
            subcommand: 'list',
            memberPermissions: {has: vi.fn(() => true)},
        },
        managerOverrides,
    });
}

describe('provider management commands', () => {
    it('lists Twitch stream live and offline states through the real command wiring', async () => {
        const getManyPlain = vi.fn(async () => [
            {id: 1, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, twitchUsername: 'live-user', isLive: true},
            {id: 2, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, twitchUsername: 'offline-user', isLive: false},
        ]);
        const {command, interaction} = await setupProviderCommand('modules/twitch/commands/manageTwitchStreams.js', {
            twitchManager: {getManyPlain},
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getManyPlain).toHaveBeenCalledWith({guildId: GUILD_ID});
        expectReplyTextContains(interaction, '`1` `live-user` -> <#123456789012345678> live');
        expectReplyTextContains(interaction, '`2` `offline-user` -> <#123456789012345678>');
    });

    it('reports Twitch integration health through the real command wiring', async () => {
        const getOnePlain = vi.fn(async () => ({
            id: 7,
            guildId: GUILD_ID,
            discordChannelId: CHANNEL_ID,
            twitchUsername: 'health-user',
            isLive: false,
            paused: false,
        }));
        const getForConfig = vi.fn(async () => ({
            provider: 'twitch',
            configId: '7',
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            status: 'healthy',
            lastCheckedAt: '2026-06-22T01:00:00.000Z',
            lastSuccessAt: '2026-06-22T01:00:00.000Z',
            lastFailureAt: null,
            lastDeliveryAt: null,
            consecutiveFailures: 0,
            metadata: null,
        }));
        const {command, interaction} = await setupCommandTest('modules/twitch/commands/manageTwitchStreams.js', {
            interaction: {
                guildId: GUILD_ID,
                subcommand: 'test',
                integerOptions: {id: 7},
                memberPermissions: {has: vi.fn(() => true)},
            },
            managerOverrides: {
                twitchManager: {getOnePlain},
                integrationHealthManager: {getForConfig},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getOnePlain).toHaveBeenCalledWith({id: 7});
        expect(getForConfig).toHaveBeenCalledWith('twitch', 7);
        expectReplyTextContains(interaction, 'Latest health for Twitch stream `health-user` from <#123456789012345678>:');
        expectReplyTextContains(interaction, 'Status: `healthy`');
    });

    it('lists TikTok stream live and offline states through the real command wiring', async () => {
        const getManyPlain = vi.fn(async () => [
            {id: 1, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, tiktokUsername: 'live-user', isLive: true},
            {id: 2, guildId: GUILD_ID, discordChannelId: CHANNEL_ID, tiktokUsername: 'offline-user', isLive: false},
        ]);
        const {command, interaction} = await setupProviderCommand('modules/tiktok/commands/manageTikTokStreams.js', {
            tiktokManager: {getManyPlain},
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getManyPlain).toHaveBeenCalledWith({guildId: GUILD_ID});
        expectReplyTextContains(interaction, '`1` `live-user` -> <#123456789012345678> live');
        expectReplyTextContains(interaction, '`2` `offline-user` -> <#123456789012345678>');
    });

    it('lists patch note subscriptions with fallback ids', async () => {
        const getManyPlain = vi.fn(async () => [
            {guildId: GUILD_ID, channelId: CHANNEL_ID, game: 'GameWithoutId'},
            {id: 2, guildId: GUILD_ID, channelId: CHANNEL_ID, game: 'GameWithId'},
        ]);
        const {command, interaction} = await setupProviderCommand('modules/patchnotes/commands/managePatchNotes.js', {
            patchSubscriptionManager: {getManyPlain},
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getManyPlain).toHaveBeenCalledWith({guildId: GUILD_ID});
        expectReplyTextContains(interaction, '`0` `GameWithoutId` -> <#123456789012345678>');
        expectReplyTextContains(interaction, '`2` `GameWithId` -> <#123456789012345678>');
    });

    it('removes a patch note subscription after mapping the raw record', async () => {
        const getOnePlain = vi.fn(async () => ({
            id: 42,
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            game: 'GameWithId',
        }));
        const removeByPk = vi.fn(async () => undefined);
        const auditRecord = vi.fn(async () => undefined);
        const {command, interaction} = await setupCommandTest('modules/patchnotes/commands/managePatchNotes.js', {
            interaction: {
                guildId: GUILD_ID,
                subcommand: 'remove',
                integerOptions: {id: 42},
                memberPermissions: {has: vi.fn(() => true)},
            },
            managerOverrides: {
                patchSubscriptionManager: {getOnePlain, removeByPk},
                auditEventManager: {record: auditRecord},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getOnePlain).toHaveBeenCalledWith({id: 42});
        expect(removeByPk).toHaveBeenCalledWith(42);
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'patchSubscription.delete',
            targetId: '42',
        }));
        expectEphemeralReply(interaction, {equals: 'Removed patch note subscription `GameWithId` in <#123456789012345678>.'});
    });

    it('reports missing patch note subscriptions from the real command wiring', async () => {
        const getOnePlain = vi.fn(async () => null);
        const removeByPk = vi.fn(async () => undefined);
        const {command, interaction} = await setupCommandTest('modules/patchnotes/commands/managePatchNotes.js', {
            interaction: {
                guildId: GUILD_ID,
                subcommand: 'remove',
                integerOptions: {id: 404},
                memberPermissions: {has: vi.fn(() => true)},
            },
            managerOverrides: {
                patchSubscriptionManager: {getOnePlain, removeByPk},
            },
        });

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(getOnePlain).toHaveBeenCalledWith({id: 404});
        expect(removeByPk).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {equals: 'That patch note subscription was not found in this server.'});
    });
});
