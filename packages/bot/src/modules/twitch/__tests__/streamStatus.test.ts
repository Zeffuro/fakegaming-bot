import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {ChatInputCommandInteraction} from 'discord.js';
import {setupCommandTest, expectReplyTextContains} from '@zeffuro/fakegaming-common/testing';

const ORIGINAL_ENV = {...process.env};

describe('stream-status command', () => {
    beforeEach(() => {
        vi.resetModules();
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

    it('reports missing Twitch credentials', async () => {
        process.env = {...ORIGINAL_ENV};
        delete process.env.TWITCH_CLIENT_ID;
        delete process.env.TWITCH_CLIENT_SECRET;
        (globalThis as any).fetch = vi.fn();
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: 'creator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Twitch credentials are not configured.');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('reports Twitch authentication failure', async () => {
        (globalThis as any).fetch = vi.fn().mockResolvedValueOnce({ok: false});
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: 'creator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Failed to authenticate with Twitch.');
    });

    it('reports unknown Twitch channels', async () => {
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ok: true, json: async () => ({access_token: 'token', expires_in: 3600})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: []})});
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: '@MissingCreator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'Twitch channel `missingcreator` was not found.');
    });

    it('reports offline Twitch channels with login fallback display names', async () => {
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ok: true, json: async () => ({access_token: 'token'})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{id: 'u1', login: 'creator'}]})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: []})});
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: 'creator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'creator is currently offline.');
    });

    it('reports live Twitch channels without optional stream metadata', async () => {
        (globalThis as any).fetch = vi.fn()
            .mockResolvedValueOnce({ok: true, json: async () => ({access_token: 'token', expires_in: 3600})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{id: 'u1', login: 'creator'}]})})
            .mockResolvedValueOnce({ok: true, json: async () => ({data: [{title: 'Live now'}]})});
        const {command, interaction} = await setupCommandTest(
            'modules/twitch/commands/streamStatus.js',
            {interaction: {stringOptions: {username: 'creator'}}}
        );

        await command.execute(interaction as unknown as ChatInputCommandInteraction);

        expectReplyTextContains(interaction, 'creator is live: **Live now**');
        expectReplyTextContains(interaction, 'Started recently');
    });
});
