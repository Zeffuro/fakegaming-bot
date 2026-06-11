import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

const ORIGINAL_ENV = {...process.env};

describe('stream-status command', () => {
    beforeEach(() => {
        process.env = {...ORIGINAL_ENV, TWITCH_CLIENT_ID: 'client', TWITCH_CLIENT_SECRET: 'secret'};
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ok: true, json: async () => ({access_token: 'token', expires_in: 3600})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{id: 'u1', login: 'creator', display_name: 'Creator'}]})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{title: 'Live now', viewer_count: 42, game_name: 'Game', started_at: '2026-06-11T10:00:00Z'}]})});
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        vi.restoreAllMocks();
    });

    it('reports a live Twitch channel', async () => {
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: 'creator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
        expectReplyTextContains(interaction, 'Creator is live');
        expectReplyTextContains(interaction, 'Live now');
    });
});
