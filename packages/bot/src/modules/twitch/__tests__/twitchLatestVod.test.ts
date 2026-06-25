import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { setupCommandTest, expectReplyTextContains } from '@zeffuro/fakegaming-common/testing';

const ORIGINAL_ENV = { ...process.env };

describe('twitch-latest-vod command', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV, TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret' };
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token', expires_in: 3600 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', login: 'creator', display_name: 'Creator' }] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'v1', title: 'Last stream', url: 'https://www.twitch.tv/videos/v1', duration: '2h3m', published_at: '2026-06-25T10:00:00Z' }] }) });
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        vi.restoreAllMocks();
    });

    it('reports the latest Twitch archive VOD', async () => {
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/twitchLatestVod.js',
            { interaction: { stringOptions: { username: 'creator' } } },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        expectReplyTextContains(interaction, 'Latest VOD from Creator');
        expectReplyTextContains(interaction, 'Last stream');
        expectReplyTextContains(interaction, 'https://www.twitch.tv/videos/v1');
    });

    it('reports when no archive VOD exists', async () => {
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token', expires_in: 3600 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'u1', login: 'creator', display_name: 'Creator' }] }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
        const { command, interaction } = await setupCommandTest(
            'modules/twitch/commands/twitchLatestVod.js',
            { interaction: { stringOptions: { username: '@Creator' } } },
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Creator does not have an archive VOD available right now.');
    });
});
