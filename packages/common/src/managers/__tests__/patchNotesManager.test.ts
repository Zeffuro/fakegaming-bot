import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { PatchNoteConfig } from '../../models/patch-note-config.js';

describe('PatchNotesManager', () => {
    const patchNotesManager = configManager.patchNotesManager;
    const patchNoteHistoryManager = configManager.patchNoteHistoryManager;

    beforeEach(async () => {
        await patchNoteHistoryManager.removeAll();
        await patchNotesManager.removeAll();
    });

    describe('getLatestPatch', () => {
        it('should return latest patch for a game', async () => {
            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
                title: 'Patch 14.1',
                content: 'Patch notes content',
                publishedAt: Date.now(),
            });

            const result = await patchNotesManager.getLatestPatch('league');

            expect(result).not.toBeNull();
            expect(result?.game).toBe('league');
            expect(result?.version).toBe('14.1');
        });

        it('should return null if no patch exists for game', async () => {
            const result = await patchNotesManager.getLatestPatch('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('setLatestPatch', () => {
        it('should create a new patch note', async () => {
            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
                title: 'Patch 14.1',
                content: 'Patch notes content',
                publishedAt: Date.now(),
            });

            const result = await patchNotesManager.getLatestPatch('league');
            expect(result).not.toBeNull();
            expect(result?.version).toBe('14.1');
        });

        it('should update existing patch note', async () => {
            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
                title: 'Patch 14.1',
                content: 'Patch notes content',
                publishedAt: Date.now(),
            });

            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.2',
                url: 'https://example.com/patch-14.2',
                title: 'Patch 14.2',
                content: 'Patch notes content',
                publishedAt: Date.now(),
            });

            const result = await patchNotesManager.getLatestPatch('league');
            expect(result?.version).toBe('14.2');
            expect(result?.url).toBe('https://example.com/patch-14.2');

            const allPatches = await patchNotesManager.getAll();
            expect(allPatches).toHaveLength(1); // Only one patch per game
            expect(allPatches[0].version).toBe('14.2');
            expect(allPatches[0].url).toBe('https://example.com/patch-14.2');
        });

        it('records patch history when latest patch includes a URL', async () => {
            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.3',
                url: 'https://example.com/patch-14.3',
                title: 'Patch 14.3',
                content: 'Patch notes content',
                publishedAt: 3000,
            });

            const history = await patchNoteHistoryManager.getHistory('league');

            expect(history).toHaveLength(1);
            expect(history[0].url).toBe('https://example.com/patch-14.3');
        });

        it('accepts model instances and skips history when URL is missing', async () => {
            const instance = await PatchNoteConfig.create({
                game: 'league',
                version: '14.4',
                title: 'Patch 14.4',
                content: 'Patch notes content',
                url: '',
                publishedAt: 4000,
            });

            await patchNotesManager.setLatestPatch(instance);

            const latest = await patchNotesManager.getLatestPatch('league');
            const history = await patchNoteHistoryManager.getHistory('league');

            expect(latest?.game).toBe('league');
            expect(latest?.title).toBe('Patch 14.4');
            expect(history).toHaveLength(0);
        });
    });
});

describe('PatchNoteHistoryManager', () => {
    const patchNoteHistoryManager = configManager.patchNoteHistoryManager;

    beforeEach(async () => {
        await patchNoteHistoryManager.removeAll();
    });

    it('upserts history records by game and URL and returns newest first', async () => {
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/older',
            title: 'Older',
            content: 'older',
            publishedAt: 1000,
        });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/newer',
            title: 'Newer',
            content: 'newer',
            publishedAt: 2000,
        });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/newer',
            title: 'Newer updated',
            content: 'newer updated',
            publishedAt: 3000,
        });

        const history = await patchNoteHistoryManager.getHistory('league', 1);

        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('https://example.com/newer');
        expect(history[0].title).toBe('Newer updated');
    });
});

describe('PatchSubscriptionManager', () => {
    const patchSubscriptionManager = configManager.patchSubscriptionManager;

    beforeEach(async () => {
        await patchSubscriptionManager.removeAll();
    });

    describe('subscribe', () => {
        it('should create a new subscription', async () => {
            await patchSubscriptionManager.subscribe('league', 'channel-1', 'guild-1');

            const subscriptions = await patchSubscriptionManager.getAll();
            expect(subscriptions).toHaveLength(1);
            expect(subscriptions[0].game).toBe('league');
            expect(subscriptions[0].channelId).toBe('channel-1');
        });

        it('should not create duplicate subscriptions', async () => {
            await patchSubscriptionManager.subscribe('league', 'channel-1', 'guild-1');
            await patchSubscriptionManager.subscribe('league', 'channel-1', 'guild-1');

            const subscriptions = await patchSubscriptionManager.getAll();
            expect(subscriptions).toHaveLength(1);
        });
    });

    describe('upsertSubscription', () => {
        it('should create a new subscription', async () => {
            await patchSubscriptionManager.upsertSubscription({
                game: 'league',
                channelId: 'channel-1',
                guildId: 'guild-1',
            });

            const subscriptions = await patchSubscriptionManager.getAll();
            expect(subscriptions).toHaveLength(1);
        });

        it('should update existing subscription', async () => {
            await patchSubscriptionManager.upsertSubscription({
                game: 'league',
                channelId: 'channel-1',
                guildId: 'guild-1',
            });

            await patchSubscriptionManager.upsertSubscription({
                game: 'league',
                channelId: 'channel-1',
                guildId: 'guild-1',
            });

            const subscriptions = await patchSubscriptionManager.getAll();
            expect(subscriptions).toHaveLength(1);
        });

        it('normalizes Date lastAnnouncedAt values before upserting', async () => {
            await patchSubscriptionManager.upsertSubscription({
                game: 'league',
                channelId: 'channel-date',
                guildId: 'guild-1',
                lastAnnouncedAt: new Date('2026-01-01T00:00:00.000Z') as unknown as number,
            });

            const subscription = await patchSubscriptionManager.getOnePlain({ channelId: 'channel-date' });

            expect(subscription?.lastAnnouncedAt).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
        });
    });
});
