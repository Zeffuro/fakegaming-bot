import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { PatchNoteConfig } from '../../models/patch-note-config.js';
import { PatchSubscriptionConfig } from '../../models/patch-subscription-config.js';

describe('PatchNotesManager', () => {
    const patchNotesManager = configManager.patchNotesManager;

    beforeEach(async () => {
        await patchNotesManager.forceTruncate();
    });

    describe('getLatestPatch', () => {
        it('should return latest patch for a game', async () => {
            await PatchNoteConfig.create({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
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
            });

            const result = await patchNotesManager.getLatestPatch('league');
            expect(result).not.toBeNull();
            expect(result?.version).toBe('14.1');
        });

        it('should update existing patch note', async () => {
            await PatchNoteConfig.create({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
            });

            await patchNotesManager.setLatestPatch({
                game: 'league',
                version: '14.2',
                url: 'https://example.com/patch-14.2',
            });

            const result = await patchNotesManager.getLatestPatch('league');
            expect(result?.version).toBe('14.2');

            const allPatches = await patchNotesManager.getAll();
            expect(allPatches).toHaveLength(1);
        });
    });

    describe('forceTruncate', () => {
        it('should truncate table in test environment', async () => {
            await PatchNoteConfig.create({
                game: 'league',
                version: '14.1',
                url: 'https://example.com/patch-14.1',
            });

            await patchNotesManager.forceTruncate();

            const allPatches = await patchNotesManager.getAll();
            expect(allPatches).toHaveLength(0);
        });
    });

    describe('getSequelize', () => {
        it('should return sequelize instance', () => {
            const sequelize = patchNotesManager.getSequelize();
            expect(sequelize).toBeDefined();
        });
    });
});

describe('PatchSubscriptionManager', () => {
    const patchSubscriptionManager = configManager.patchSubscriptionManager;

    beforeEach(async () => {
        await patchSubscriptionManager.remove({});
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
            await PatchSubscriptionConfig.create({
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
    });
});
