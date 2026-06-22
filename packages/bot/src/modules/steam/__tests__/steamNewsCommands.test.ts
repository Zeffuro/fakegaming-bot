import { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    createMockAutocompleteInteraction,
    expectEphemeralReply,
    expectReplyTextContains,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import { resolveSteamAppInput, searchSteamApps } from '@zeffuro/fakegaming-common/steam';

vi.mock('@zeffuro/fakegaming-common/steam', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/steam')>();
    return {
        ...actual,
        resolveSteamAppInput: vi.fn(),
        searchSteamApps: vi.fn(),
    };
});

vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn(),
}));

const GUILD_ID = '987654321098765432';
const CHANNEL_ID = '123456789012345678';

async function mockAdmin(allowed: boolean) {
    const permissions = await import('../../../utils/permissions.js');
    vi.mocked(permissions.requireAdmin).mockResolvedValue(allowed);
    return permissions;
}

describe('Steam news commands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds a Steam news subscription from a game title', async () => {
        await mockAdmin(true);
        vi.mocked(resolveSteamAppInput).mockResolvedValue({
            status: 'resolved',
            app: {
                steamAppId: 730,
                appName: 'Counter-Strike 2',
                score: 1000,
            },
        });
        const getOnePlain = vi.fn(async () => null);
        const addPlain = vi.fn(async () => ({ id: 44 }));
        const auditRecord = vi.fn(async () => undefined);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: GUILD_ID,
                stringOptions: {
                    game: 'Counter-Strike 2',
                    message: 'Update dropped',
                },
                channelOptions: {
                    channel: CHANNEL_ID,
                },
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getOnePlain,
                    addPlain,
                },
                auditEventManager: {
                    record: auditRecord,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getOnePlain).toHaveBeenCalledWith({
            steamAppId: 730,
            discordChannelId: CHANNEL_ID,
            guildId: GUILD_ID,
        });
        expect(addPlain).toHaveBeenCalledWith({
            steamAppId: 730,
            appName: 'Counter-Strike 2',
            discordChannelId: CHANNEL_ID,
            guildId: GUILD_ID,
            customMessage: 'Update dropped',
        });
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'steamNewsSubscription.create',
            targetType: 'steamNewsSubscription',
            targetId: '44',
            guildId: GUILD_ID,
        }));
        expectReplyTextContains(interaction, 'Subscribed <#123456789012345678> to Steam news for `Counter-Strike 2`');
    });

    it('rejects Steam news setup outside a server before admin checks', async () => {
        const permissions = await mockAdmin(true);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: null,
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(permissions.requireAdmin).not.toHaveBeenCalled();
        expect(resolveSteamAppInput).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, { equals: 'This command can only be used in a server.' });
    });

    it('stops Steam news setup when the user is not an admin', async () => {
        await mockAdmin(false);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: GUILD_ID,
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(resolveSteamAppInput).not.toHaveBeenCalled();
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('reports unresolved Steam games with sanitized inline input', async () => {
        await mockAdmin(true);
        vi.mocked(resolveSteamAppInput).mockResolvedValue({ status: 'not_found', suggestions: [] });
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: GUILD_ID,
                stringOptions: {
                    game: 'missing`game',
                },
                channelOptions: {
                    channel: CHANNEL_ID,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(resolveSteamAppInput).toHaveBeenCalledWith('missing`game', { limit: 5 });
        expectEphemeralReply(interaction, {
            equals: "I could not find a Steam app for `missing'game`. Try a Steam store URL or App ID.",
        });
    });

    it('rejects ambiguous Steam title matches', async () => {
        await mockAdmin(true);
        vi.mocked(resolveSteamAppInput).mockResolvedValue({
            status: 'ambiguous',
            suggestions: [
                { steamAppId: 730, appName: 'Counter-Strike 2', score: 900 },
                { steamAppId: 10, appName: 'Counter-Strike', score: 900 },
            ],
        });
        const addPlain = vi.fn();
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                guildId: GUILD_ID,
                stringOptions: {
                    game: 'counter',
                },
                channelOptions: {
                    channel: CHANNEL_ID,
                },
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    addPlain,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(addPlain).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, { contains: 'Multiple Steam apps matched `counter`' });
        expectReplyTextContains(interaction, '`Counter-Strike 2` (730)');
    });

    it('does not create duplicate Steam news subscriptions', async () => {
        await mockAdmin(true);
        vi.mocked(resolveSteamAppInput).mockResolvedValue({
            status: 'resolved',
            app: {
                steamAppId: 440,
                appName: 'Team`Fortress 2',
                score: 1000,
            },
        });
        const getOnePlain = vi.fn(async () => ({ id: 77 }));
        const addPlain = vi.fn();
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: GUILD_ID,
                stringOptions: {
                    game: 'tf2',
                },
                channelOptions: {
                    channel: CHANNEL_ID,
                },
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getOnePlain,
                    addPlain,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(addPlain).not.toHaveBeenCalled();
        expectEphemeralReply(interaction, {
            equals: "Steam news for `Team'Fortress 2` is already configured in <#123456789012345678>.",
        });
    });

    it('uses a deterministic audit target when the created Steam subscription has no id', async () => {
        await mockAdmin(true);
        vi.mocked(resolveSteamAppInput).mockResolvedValue({
            status: 'resolved',
            app: {
                steamAppId: 620,
                appName: 'Portal 2',
                score: 1000,
            },
        });
        const auditRecord = vi.fn(async () => undefined);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/addSteamNews.js', {
            interaction: {
                commandName: 'add-steam-news',
                guildId: GUILD_ID,
                stringOptions: {
                    game: 'Portal 2',
                },
                channelOptions: {
                    channel: CHANNEL_ID,
                },
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getOnePlain: vi.fn(async () => null),
                    addPlain: vi.fn(async () => ({})),
                },
                auditEventManager: {
                    record: auditRecord,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            targetId: `620:${CHANNEL_ID}`,
            metadata: expect.objectContaining({
                steamAppId: 620,
                appName: 'Portal 2',
            }),
        }));
        expectReplyTextContains(interaction, 'https://store.steampowered.com/app/620');
    });

    it('autocompletes Steam app search results', async () => {
        vi.mocked(searchSteamApps).mockResolvedValue([
            { steamAppId: 400, appName: 'Portal', score: 1000 },
            { steamAppId: 620, appName: 'Portal 2', score: 930 },
        ]);
        const { command } = await setupCommandTest('modules/steam/commands/addSteamNews.js');
        const interaction = createMockAutocompleteInteraction({ focused: 'portal' });

        await command.autocomplete(interaction as AutocompleteInteraction);

        expect(searchSteamApps).toHaveBeenCalledWith('portal', { limit: 10 });
        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'Portal (400)', value: 'steam:400' },
            { name: 'Portal 2 (620)', value: 'steam:620' },
        ]);
    });

    it('returns no Steam autocomplete suggestions for short inputs', async () => {
        const { command } = await setupCommandTest('modules/steam/commands/addSteamNews.js');
        const interaction = createMockAutocompleteInteraction({ focused: ' p ' });

        await command.autocomplete(interaction as AutocompleteInteraction);

        expect(searchSteamApps).not.toHaveBeenCalled();
        expect(interaction.respond).toHaveBeenCalledWith([]);
    });

    it('truncates long Steam autocomplete labels', async () => {
        vi.mocked(searchSteamApps).mockResolvedValue([
            { steamAppId: 123456, appName: 'A'.repeat(120), score: 900 },
        ]);
        const { command } = await setupCommandTest('modules/steam/commands/addSteamNews.js');
        const interaction = createMockAutocompleteInteraction({ focused: 'long game' });

        await command.autocomplete(interaction as AutocompleteInteraction);

        const [choices] = vi.mocked(interaction.respond).mock.calls[0] ?? [[]];
        expect(choices).toEqual([
            { name: `${'A'.repeat(97)}...`, value: 'steam:123456' },
        ]);
    });

    it('returns no Steam autocomplete suggestions when search fails', async () => {
        vi.mocked(searchSteamApps).mockRejectedValue(new Error('steam unavailable'));
        const { command } = await setupCommandTest('modules/steam/commands/addSteamNews.js');
        const interaction = createMockAutocompleteInteraction({ focused: 'portal' });

        await command.autocomplete(interaction as AutocompleteInteraction);

        expect(searchSteamApps).toHaveBeenCalledWith('portal', { limit: 10 });
        expect(interaction.respond).toHaveBeenCalledWith([]);
    });

    it('lists configured Steam news subscriptions', async () => {
        await mockAdmin(true);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/manageSteamNews.js', {
            interaction: {
                commandName: 'manage-steam-news',
                subcommand: 'list',
                guildId: GUILD_ID,
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getManyPlain: vi.fn(async () => [
                        {
                            id: 7,
                            steamAppId: 570,
                            appName: 'Dota 2',
                            guildId: GUILD_ID,
                            discordChannelId: CHANNEL_ID,
                            paused: true,
                        },
                    ]),
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Configured Steam news subscriptions:');
        expectReplyTextContains(interaction, '`7` `Dota 2` (570) -> <#123456789012345678> paused');
    });

    it('lists Steam news subscriptions with fallback ids and labels', async () => {
        const getManyPlain = vi.fn(async () => [
            {
                steamAppId: 10,
                appName: '   ',
                guildId: GUILD_ID,
                discordChannelId: CHANNEL_ID,
                paused: false,
            },
            {
                id: 9,
                steamAppId: 20,
                appName: null,
                guildId: GUILD_ID,
                discordChannelId: CHANNEL_ID,
            },
        ]);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/manageSteamNews.js', {
            interaction: {
                commandName: 'manage-steam-news',
                subcommand: 'list',
                guildId: GUILD_ID,
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getManyPlain,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getManyPlain).toHaveBeenCalledWith({ guildId: GUILD_ID });
        expectReplyTextContains(interaction, '`0` `Steam app 10` (10) -> <#123456789012345678>');
        expectReplyTextContains(interaction, '`9` `Steam app 20` (20) -> <#123456789012345678>');
    });

    it('pauses Steam news subscriptions and records provider health metadata', async () => {
        const setPaused = vi.fn(async () => undefined);
        const auditRecord = vi.fn(async () => undefined);
        const recordStatus = vi.fn(async () => undefined);
        const { command, interaction } = await setupCommandTest('modules/steam/commands/manageSteamNews.js', {
            interaction: {
                commandName: 'manage-steam-news',
                subcommand: 'pause',
                integerOptions: { id: 8 },
                guildId: GUILD_ID,
            },
            managerOverrides: {
                steamNewsSubscriptionManager: {
                    getOnePlain: vi.fn(async () => ({
                        id: 8,
                        steamAppId: 80,
                        appName: null,
                        guildId: GUILD_ID,
                        discordChannelId: CHANNEL_ID,
                        paused: false,
                    })),
                    setPaused,
                },
                auditEventManager: {
                    record: auditRecord,
                },
                integrationHealthManager: {
                    recordStatus,
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(setPaused).toHaveBeenCalledWith(8, true);
        expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
            action: 'steamNewsSubscription.pause',
            metadata: expect.objectContaining({
                channelId: CHANNEL_ID,
                steamAppId: 80,
                appName: null,
                paused: true,
            }),
        }));
        expect(recordStatus).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'steamnews',
            configId: 8,
            channelId: CHANNEL_ID,
            status: 'paused',
            metadata: {
                paused: true,
                steamAppId: 80,
                appName: null,
            },
        }));
        expectEphemeralReply(interaction, {
            equals: 'Paused Steam news subscription `Steam app 80` in <#123456789012345678>.',
        });
    });
});
