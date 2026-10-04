import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwitchClipConfig, TwitchClipCooldown, TwitchClipRequest } from '@zeffuro/fakegaming-common/models';
import { buildTwitchClipReply, replyToTwitchClipRequest } from '../chatReply.js';
import { getTwitchClipBotToken } from '../botAuth.js';
import { sendTwitchClipChatMessage } from '../helix.js';
import { resolveGuildOutputLocale } from '../../localization/locale.js';
import { reserveTwitchClipRequest } from '../requestStore.js';
import type { TwitchClipChatMessage } from '../chatMessage.js';

vi.mock('../botAuth.js', () => ({ getTwitchClipBotToken: vi.fn() }));
vi.mock('../helix.js', () => ({ sendTwitchClipChatMessage: vi.fn() }));
vi.mock('../../localization/locale.js', async importOriginal => ({
    ...await importOriginal<typeof import('../../localization/locale.js')>(), resolveGuildOutputLocale: vi.fn(),
}));

const message: TwitchClipChatMessage = {
    broadcaster_user_id: 'streamer', broadcaster_user_name: 'Streamer', chatter_user_id: 'viewer',
    chatter_user_name: 'Viewer', message_id: 'request', message: { text: '!clip' }, badges: [],
};
const token = { accessToken: 'test-token', userId: 'bot', login: 'clipbot', chatReplyAuthorized: true };
const url = 'https://clips.twitch.tv/Clip';
let testTime = Date.now();

beforeEach(async () => {
    await TwitchClipRequest.destroy({ where: {} });
    await TwitchClipCooldown.destroy({ where: {} });
    await TwitchClipConfig.destroy({ where: {} });
    vi.mocked(getTwitchClipBotToken).mockResolvedValue(token);
    vi.mocked(sendTwitchClipChatMessage).mockResolvedValue(undefined);
    vi.mocked(resolveGuildOutputLocale).mockResolvedValue('en');
    testTime += 60_000;
    vi.spyOn(Date, 'now').mockReturnValue(testTime);
});

async function setup(extra: Record<string, unknown> = {}) {
    const config = await TwitchClipConfig.create({
        guildId: 'guild', broadcasterId: 'streamer', twitchUsername: 'streamer', discordChannelId: 'channel', ...extra,
    });
    const request = await reserveTwitchClipRequest(message, [config], new Date(Date.now()));
    return { config, request: request! };
}

describe('Twitch clip chat replies', () => {
    it('uses guild output language for defaults and leaves custom text verbatim', () => {
        const config = { twitchUsername: 'streamer', replyTemplate: null };
        expect(buildTwitchClipReply(config, 'Viewer', { url }, 'en')).toBe(`@Viewer Clip created! ${url}`);
        expect(buildTwitchClipReply(config, 'Viewer', { url }, 'nl')).toBe(`@Viewer Clip gemaakt! ${url}`);
        expect(buildTwitchClipReply({ ...config, replyTemplate: '{user} clipped {channel}: {url}' }, 'Viewer', { url }, 'nl'))
            .toBe(`Viewer clipped streamer: ${url}`);
        expect(buildTwitchClipReply({ ...config, replyTemplate: '  ' }, 'Viewer', { url }, 'nl')).toContain('Clip gemaakt!');
        expect(buildTwitchClipReply(config, 'Viewer', { errorCode: 'twitch_http_404' }, 'nl')).toContain('streamer live is');
        expect(buildTwitchClipReply(config, 'Viewer', { errorCode: 'twitch_http_403' }, 'en')).toContain('clips are enabled');
    });

    it('falls back to a complete URL when template expansion exceeds the chat limit', () => {
        const result = buildTwitchClipReply({ twitchUsername: 'streamer', replyTemplate: '{url}'.repeat(80) }, 'Viewer', { url }, 'en');
        expect(result).toBe(`@Viewer Clip created! ${url}`);
        expect(buildTwitchClipReply({ twitchUsername: 'streamer', replyTemplate: '{user}' }, 'View\ner\u0000', { url }, 'en')).toBe('Viewer');
    });

    it('selects one matching server deterministically and atomically sends once across reloads', async () => {
        const { config, request } = await setup({ id: 'b', replyTemplate: 'Other {url}' });
        const selected = await TwitchClipConfig.create({
            id: 'a', guildId: 'dutch', broadcasterId: 'streamer', twitchUsername: 'streamer', discordChannelId: 'other',
        });
        vi.mocked(resolveGuildOutputLocale).mockResolvedValue('nl');
        await Promise.all([
            replyToTwitchClipRequest(request, [config, selected], { url }),
            replyToTwitchClipRequest((await TwitchClipRequest.findByPk(request.id))!, [selected, config], { url }),
        ]);
        expect(resolveGuildOutputLocale).toHaveBeenCalledWith('dutch');
        expect(sendTwitchClipChatMessage).toHaveBeenCalledExactlyOnceWith('streamer', 'request', `@Viewer Clip gemaakt! ${url}`, token);
        expect((await TwitchClipRequest.findByPk(request.id))?.replyAttemptedAt).not.toBeNull();
        await replyToTwitchClipRequest((await TwitchClipRequest.findByPk(request.id))!, [selected], { url });
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
    });

    it('preserves clip operation with old authorization and allows reconnect before delivery retry', async () => {
        const { config, request } = await setup();
        vi.mocked(getTwitchClipBotToken).mockResolvedValueOnce({ ...token, chatReplyAuthorized: false });
        await replyToTwitchClipRequest(request, [config], { url });
        expect(sendTwitchClipChatMessage).not.toHaveBeenCalled();
        expect((await TwitchClipRequest.findByPk(request.id))?.replyAttemptedAt).toBeNull();
        await replyToTwitchClipRequest(request, [config], { url });
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
    });

    it('silences disabled or stale replies and never repeats an uncertain failed send', async () => {
        const { config, request } = await setup({ replyEnabled: false });
        await replyToTwitchClipRequest(request, [config], { url });
        expect(sendTwitchClipChatMessage).not.toHaveBeenCalled();
        await config.update({ replyEnabled: true });
        await request.update({ requestedAt: new Date(Date.now() - 121_000) });
        await replyToTwitchClipRequest(request, [config], { url });
        expect(sendTwitchClipChatMessage).not.toHaveBeenCalled();
        await request.update({ requestedAt: new Date(Date.now()) });
        vi.mocked(sendTwitchClipChatMessage).mockRejectedValueOnce(new Error('connection closed after send'));
        await expect(replyToTwitchClipRequest(request, [config], { url })).resolves.toBeUndefined();
        await replyToTwitchClipRequest((await TwitchClipRequest.findByPk(request.id))!, [config], { url });
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
    });

    it('caps replies across different streamers at twenty attempts per thirty seconds', async () => {
        const { config, request } = await setup();
        for (let i = 0; i < 21; i++) {
            const next = await TwitchClipRequest.create({ ...request.toJSON(), id: `rate-${i}`, broadcasterId: `streamer-${i}`, replyAttemptedAt: null });
            await replyToTwitchClipRequest(next, [config], { url });
        }
        expect(sendTwitchClipChatMessage).toHaveBeenCalledTimes(20);
        expect((await TwitchClipRequest.findByPk('rate-20'))?.replyAttemptedAt).not.toBeNull();
    });

    it('limits concurrent completed requests to one reply per second in one channel', async () => {
        const { config, request } = await setup();
        const next = await TwitchClipRequest.create({ ...request.toJSON(), id: 'second-request', replyAttemptedAt: null });
        await Promise.all([replyToTwitchClipRequest(request, [config], { url }), replyToTwitchClipRequest(next, [config], { url })]);
        expect(sendTwitchClipChatMessage).toHaveBeenCalledOnce();
        expect((await TwitchClipRequest.findByPk(next.id))?.replyAttemptedAt).not.toBeNull();
        testTime += 1000;
        vi.spyOn(Date, 'now').mockReturnValue(testTime);
        const later = await TwitchClipRequest.create({ ...request.toJSON(), id: 'later-request', replyAttemptedAt: null });
        await replyToTwitchClipRequest(later, [config], { url });
        expect(sendTwitchClipChatMessage).toHaveBeenCalledTimes(2);
    });
});
