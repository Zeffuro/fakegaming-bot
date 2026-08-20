import type {ChatInputCommandInteraction} from 'discord.js';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {setupCommandTest} from '@zeffuro/fakegaming-common/testing';
import addBlueskyAccount from '../../bluesky/commands/addBlueskyAccount.js';
import manageBlueskyAccounts from '../../bluesky/commands/manageBlueskyAccounts.js';
import addSteamNews from '../../steam/commands/addSteamNews.js';
import manageSteamNews from '../../steam/commands/manageSteamNews.js';
import addTikTokStream from '../../tiktok/commands/addTikTokStream.js';
import manageTikTokStreams from '../../tiktok/commands/manageTikTokStreams.js';
import addTwitchStream from '../../twitch/commands/addTwitchStream.js';
import manageTwitchStreams from '../../twitch/commands/manageTwitchStreams.js';
import streamStatus from '../../twitch/commands/streamStatus.js';
import twitchLatestVod from '../../twitch/commands/twitchLatestVod.js';
import addYoutubeVideoChannel from '../../youtube/commands/addYoutubeVideoChannel.js';
import manageYoutubeChannels from '../../youtube/commands/manageYoutubeChannels.js';
import youtubeLatest from '../../youtube/commands/youtubeLatest.js';
import {verifyBlueskyHandleApi} from '../../../utils/apiClient.js';

vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../utils/apiClient.js', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../utils/apiClient.js')>();
    return {...actual, verifyBlueskyHandleApi: vi.fn()};
});

interface LocalizedNode {
    name: string;
    description?: string;
    name_localizations?: Record<string, string> | null;
    description_localizations?: Record<string, string> | null;
    options?: LocalizedNode[];
    choices?: Array<{name_localizations?: Record<string, string> | null}>;
}

function assertLocalized(node: LocalizedNode): void {
    expect(node.name_localizations?.nl, `${node.name} Dutch name`).toBeTruthy();
    if (node.description !== undefined) {
        expect(node.description_localizations?.nl, `${node.name} Dutch description`).toBeTruthy();
    }
    for (const choice of node.choices ?? []) expect(choice.name_localizations?.nl).toBeTruthy();
    for (const option of node.options ?? []) assertLocalized(option);
}

const dutchLocaleManager = {getOutputLocale: vi.fn().mockResolvedValue('nl')};
const originalEnv = {...process.env};

describe('social provider localization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dutchLocaleManager.getOutputLocale.mockResolvedValue('nl');
    });

    afterEach(() => {
        process.env = {...originalEnv};
        vi.unstubAllGlobals();
    });

    it('provides Dutch metadata throughout every provider command tree', () => {
        const commands = [
            addBlueskyAccount, manageBlueskyAccounts,
            addSteamNews, manageSteamNews,
            addTikTokStream, manageTikTokStreams,
            addTwitchStream, manageTwitchStreams, streamStatus, twitchLatestVod,
            addYoutubeVideoChannel, manageYoutubeChannels, youtubeLatest,
        ];
        for (const command of commands) assertLocalized(command.data.toJSON() as LocalizedNode);
    });

    it('localizes subscription management while preserving provider identifiers', async () => {
        const {command, interaction} = await setupCommandTest('modules/bluesky/commands/manageBlueskyAccounts.js', {
            interaction: {subcommand: 'list'},
            managerOverrides: {
                guildLocaleConfigManager: dutchLocaleManager,
                blueskyManager: {
                    getManyPlain: vi.fn().mockResolvedValue([{
                        id: 12,
                        blueskyHandle: 'provider.example',
                        guildId: '135381928284343204',
                        discordChannelId: '123456789012345678',
                    }]),
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        const reply = vi.mocked(interaction.reply).mock.calls[0]?.[0] as {content: string};
        expect(reply.content).toContain('Ingestelde Bluesky-accounts:');
        expect(reply.content).toContain('`provider.example`');
        expect(reply.content).toContain('<#123456789012345678>');
    });

    it('localizes subscription setup while preserving the entered account', async () => {
        vi.mocked(verifyBlueskyHandleApi).mockResolvedValue({exists: true, handle: 'provider.example'});
        const {command, interaction} = await setupCommandTest('modules/bluesky/commands/addBlueskyAccount.js', {
            interaction: {
                stringOptions: {username: '@provider.example'},
                channelOptions: {channel: '123456789012345678'},
            },
            managerOverrides: {
                guildLocaleConfigManager: dutchLocaleManager,
                blueskyManager: {
                    accountExists: vi.fn().mockResolvedValue(false),
                    add: vi.fn().mockResolvedValue(undefined),
                },
            },
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith('Bluesky-account `@provider.example` toegevoegd voor meldingen in <#123456789012345678>.');
    });

    it('localizes Twitch live status while preserving stream metadata', async () => {
        process.env.TWITCH_CLIENT_ID = 'client';
        process.env.TWITCH_CLIENT_SECRET = 'secret';
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ok: true, json: async () => ({access_token: 'token', expires_in: 3600})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{id: 'u1', login: 'creator', display_name: 'Creator'}]})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{title: 'Provider stream title', viewer_count: 42, game_name: 'Provider Game'}]})}));
        const {command, interaction} = await setupCommandTest('modules/twitch/commands/streamStatus.js', {
            interaction: {stringOptions: {username: 'creator'}},
            managerOverrides: {guildLocaleConfigManager: dutchLocaleManager},
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Creator is live en speelt **Provider Game** met **42** kijkers'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Provider stream title'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Gestart onlangs'));
    });

    it('localizes YouTube latest-video framing while preserving feed content', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            text: async () => '<feed><entry><yt:videoId>v1</yt:videoId><title>Provider Video</title><author><name>Provider Channel</name></author></entry></feed>',
        }));
        const {command, interaction} = await setupCommandTest('modules/youtube/commands/youtubeLatest.js', {
            interaction: {stringOptions: {channel: 'UC-provider'}},
            managerOverrides: {guildLocaleConfigManager: dutchLocaleManager},
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Nieuwste video van Provider Channel'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Provider Video'));
        expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('watch?v=v1'));
    });
});
