import type {ChatInputCommandInteraction} from 'discord.js';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
    expectEphemeralReply,
    expectReplyTextContains,
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
    subcommand: 'subscribe' | 'unsubscribe' | 'pause' | 'resume' | 'test';
    subscribeChannel?: ReturnType<typeof vi.fn>;
    unsubscribeChannel?: ReturnType<typeof vi.fn>;
    setPaused?: ReturnType<typeof vi.fn>;
    getSubscription?: ReturnType<typeof vi.fn>;
    auditRecord?: ReturnType<typeof vi.fn>;
    recordStatus?: ReturnType<typeof vi.fn>;
    getForConfig?: ReturnType<typeof vi.fn>;
}) {
    const upsertTitle = vi.fn(async () => undefined);
    const upsertEpisode = vi.fn(async () => undefined);
    const subscribeChannel = options.subscribeChannel ?? vi.fn(async () => true);
    const unsubscribeChannel = options.unsubscribeChannel ?? vi.fn(async () => 1);
    const setPaused = options.setPaused ?? vi.fn(async () => undefined);
    const getSubscription = options.getSubscription ?? vi.fn(async () => ({
        id: 77,
        anilistId: animeResult.id,
        targetType: 'channel',
        guildId: GUILD_ID,
        channelId: CHANNEL_ID,
        reminderMinutes: 30,
        paused: false,
    }));
    const auditRecord = options.auditRecord ?? vi.fn(async () => undefined);
    const recordStatus = options.recordStatus ?? vi.fn(async () => undefined);
    const getForConfig = options.getForConfig ?? vi.fn(async () => null);

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
                    setPaused,
                    getOnePlain: getSubscription,
                },
            },
            auditEventManager: {record: auditRecord},
            integrationHealthManager: {recordStatus, getForConfig},
        },
    });

    return {
        ...setup,
        auditRecord,
        getSubscription,
        setPaused,
        subscribeChannel,
        unsubscribeChannel,
        upsertTitle,
        recordStatus,
        getForConfig,
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

    it('records audit and health events for channel subscription pauses', async () => {
        const setPaused = vi.fn(async () => undefined);
        const recordStatus = vi.fn(async () => undefined);
        const auditRecord = vi.fn(async () => undefined);
        const {command, interaction} = await setupAnimeCommand({
            subcommand: 'pause',
            setPaused,
            recordStatus,
            auditRecord,
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(setPaused).toHaveBeenCalledWith(77, true);
        expect(auditRecord).toHaveBeenCalledWith({
            actorId: '123456789012345678',
            actorType: 'user',
            action: 'animeSubscription.pause',
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
                targetType: 'channel',
                paused: true,
            },
        });
        expect(recordStatus).toHaveBeenCalledWith({
            provider: 'anime',
            configId: 77,
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            status: 'paused',
            metadata: {
                anilistId: animeResult.id,
                targetType: 'channel',
                paused: true,
            },
        });
        expectEphemeralReply(interaction, {equals: 'Paused <#123456789012345678> reminders for **Test Anime**.'});
    });

    it('reports latest channel subscription health without running a live provider check', async () => {
        const getForConfig = vi.fn(async () => ({
            provider: 'anime',
            configId: '77',
            guildId: GUILD_ID,
            channelId: CHANNEL_ID,
            status: 'warning',
            lastCheckedAt: '2026-06-22T01:30:00.000Z',
            lastSuccessAt: '2026-06-22T01:20:00.000Z',
            lastFailureAt: null,
            lastDeliveryAt: '2026-06-22T01:25:00.000Z',
            consecutiveFailures: 0,
            metadata: null,
        }));
        const {command, interaction} = await setupAnimeCommand({
            subcommand: 'test',
            getForConfig,
        });

        await command.execute(interaction as ChatInputCommandInteraction);

        expect(getForConfig).toHaveBeenCalledWith('anime', 77);
        expectReplyTextContains(interaction, 'Latest health for <#123456789012345678> reminders for **Test Anime**:');
        expectReplyTextContains(interaction, 'Status: `warning`');
        expectReplyTextContains(interaction, 'Last checked: 2026-06-22T01:30:00.000Z');
    });
});
