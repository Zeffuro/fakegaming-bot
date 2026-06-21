import type {ChatInputCommandInteraction} from 'discord.js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    expectEphemeralReply,
    setupCommandTest,
} from '@zeffuro/fakegaming-common/testing';
import type {AniListTitle} from '@zeffuro/fakegaming-common/anime';
import {requireAdmin} from '../../../utils/permissions.js';

vi.mock('../../../utils/permissions.js', () => ({
    requireAdmin: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/anime', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@zeffuro/fakegaming-common/anime')>();
    return {
        ...actual,
        getAniListAnimeById: vi.fn(),
        isAniListSubscribable: vi.fn(),
        mapAniListTitleToInput: vi.fn((title: AniListTitle) => ({anilistId: title.id})),
        searchAniListAnime: vi.fn(),
    };
});

const GUILD_ID = '987654321098765432';
const CHANNEL_ID = '123456789012345678';
const COMMAND_CHANNEL_ID = '929533532185956352';

const animeResult: AniListTitle = {
    id: 101,
    type: 'ANIME',
    title: {
        english: 'Test Anime',
        romaji: 'Test Anime Romaji',
    },
    status: 'RELEASING',
    format: 'TV',
    episodes: 12,
};

async function getAnimeMocks() {
    const anime = await import('@zeffuro/fakegaming-common/anime');
    return {
        getAniListAnimeById: vi.mocked(anime.getAniListAnimeById),
        isAniListSubscribable: vi.mocked(anime.isAniListSubscribable),
    } as const;
}

async function setupAnimeCommand(options: {
    subcommand: 'subscribe' | 'unsubscribe';
    subscribeChannel?: ReturnType<typeof vi.fn>;
    unsubscribeChannel?: ReturnType<typeof vi.fn>;
    getSubscription?: ReturnType<typeof vi.fn>;
    auditRecord?: ReturnType<typeof vi.fn>;
}) {
    const upsertTitle = vi.fn(async () => undefined);
    const upsertEpisode = vi.fn(async () => undefined);
    const subscribeChannel = options.subscribeChannel ?? vi.fn(async () => true);
    const unsubscribeChannel = options.unsubscribeChannel ?? vi.fn(async () => 1);
    const getSubscription = options.getSubscription ?? vi.fn(async () => ({
        id: 77,
        anilistId: animeResult.id,
        targetType: 'channel',
        guildId: GUILD_ID,
        channelId: CHANNEL_ID,
        reminderMinutes: 30,
    }));
    const auditRecord = options.auditRecord ?? vi.fn(async () => undefined);

    const setup = await setupCommandTest('modules/anime/commands/anime.js', {
        interaction: {
            commandName: 'anime',
            subcommand: options.subcommand,
            guildId: GUILD_ID,
            channelId: COMMAND_CHANNEL_ID,
            stringOptions: {title: `anilist:${animeResult.id}`},
            channelOptions: {channel: CHANNEL_ID},
            integerOptions: {'reminder-minutes': 45},
        },
        managerOverrides: {
            animeManager: {
                titles: {upsertTitle},
                episodes: {upsertEpisode},
                subscriptions: {
                    subscribeChannel,
                    unsubscribeChannel,
                    getOnePlain: getSubscription,
                },
            },
            auditEventManager: {record: auditRecord},
        },
    });

    return {
        ...setup,
        auditRecord,
        getSubscription,
        subscribeChannel,
        unsubscribeChannel,
        upsertTitle,
    } as const;
}

describe('anime command audit events', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.mocked(requireAdmin).mockResolvedValue(true);
        const {getAniListAnimeById, isAniListSubscribable} = await getAnimeMocks();
        getAniListAnimeById.mockResolvedValue(animeResult);
        isAniListSubscribable.mockReturnValue(true);
    });

    it('records audit events for channel subscription creates', async () => {
        const subscribeChannel = vi.fn(async () => true);
        const auditRecord = vi.fn(async () => undefined);
        const {command, interaction} = await setupAnimeCommand({
            subcommand: 'subscribe',
            subscribeChannel,
            auditRecord,
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(subscribeChannel).toHaveBeenCalledWith({
            anilistId: animeResult.id,
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            reminderMinutes: 45,
        });
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'animeSubscription.create',
            targetType: 'animeSubscription',
            targetId: String(animeResult.id),
            guildId: GUILD_ID,
            severity: 'info',
            status: 'success',
            metadata: {
                source: 'discordCommand',
                commandName: 'anime',
                commandChannelId: COMMAND_CHANNEL_ID,
                channelId: CHANNEL_ID,
                reminderMinutes: 45,
            },
        });
        expectEphemeralReply(interaction, {equals: 'Subscribed <#123456789012345678> to **Test Anime**.'});
    });

    it('records audit events for channel subscription removals', async () => {
        const unsubscribeChannel = vi.fn(async () => 1);
        const getSubscription = vi.fn(async () => ({
            id: 77,
            anilistId: animeResult.id,
            targetType: 'channel',
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            reminderMinutes: 30,
        }));
        const auditRecord = vi.fn(async () => undefined);
        const {command, interaction} = await setupAnimeCommand({
            subcommand: 'unsubscribe',
            unsubscribeChannel,
            getSubscription,
            auditRecord,
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getSubscription).toHaveBeenCalledWith({
            anilistId: animeResult.id,
            targetType: 'channel',
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
        });
        expect(unsubscribeChannel).toHaveBeenCalledWith({
            anilistId: animeResult.id,
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
        });
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'animeSubscription.delete',
            targetType: 'animeSubscription',
            targetId: '77',
            guildId: GUILD_ID,
            severity: 'info',
            status: 'success',
            metadata: {
                source: 'discordCommand',
                commandName: 'anime',
                commandChannelId: COMMAND_CHANNEL_ID,
                anilistId: animeResult.id,
                channelId: CHANNEL_ID,
            },
        });
        expectEphemeralReply(interaction, {equals: 'Unsubscribed <#123456789012345678> from **Test Anime**.'});
    });
});
