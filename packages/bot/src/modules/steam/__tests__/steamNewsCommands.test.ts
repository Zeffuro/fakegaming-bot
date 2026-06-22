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
});
