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
                publishedAt: Date.now(),
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
        const baseTime = Date.now();
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/older',
            title: 'Older',
            content: 'older',
            publishedAt: baseTime,
        });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/newer',
            title: 'Newer',
            content: 'newer',
            publishedAt: baseTime + 1000,
        });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/newer',
            title: 'Newer updated',
            content: 'newer updated',
            publishedAt: baseTime + 2000,
        });

        const history = await patchNoteHistoryManager.getHistory('league', 1);

        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('https://example.com/newer');
        expect(history[0].title).toBe('Newer updated');
        expect(history[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('dedupes history records by content hash when URLs change', async () => {
        const firstResult = await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/patch-v1',
            title: 'Patch',
            content: 'same patch body',
            publishedAt: Date.now(),
        });
        const secondResult = await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/patch-v1-canonical',
            title: 'Patch canonical',
            content: 'same patch body',
            publishedAt: Date.now() + 1000,
        });

        const history = await patchNoteHistoryManager.getHistory('league', 10);

        expect(firstResult.inserted).toBe(true);
        expect(secondResult.inserted).toBe(false);
        expect(history).toHaveLength(1);
        expect(history[0].url).toBe('https://example.com/patch-v1-canonical');
        expect(history[0].title).toBe('Patch canonical');
    });

    it('truncates stored patch content to the configured byte limit', async () => {
        const result = await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/large',
            title: 'Large',
            content: 'abcdef',
            publishedAt: Date.now(),
        }, { maxContentBytes: 3 });

        const history = await patchNoteHistoryManager.getHistory('league');

        expect(result.contentTruncated).toBe(true);
        expect(result.contentBytes).toBe(3);
        expect(history[0].content).toBe('abc');
    });

    it('prunes patch history beyond the configured per-game row limit', async () => {
        const baseTime = new Date('2026-06-25T00:00:00.000Z').getTime();
        for (let index = 1; index <= 4; index += 1) {
            await patchNoteHistoryManager.recordPatch({
                game: 'league',
                url: `https://example.com/${index}`,
                title: `Patch ${index}`,
                content: `content ${index}`,
                publishedAt: baseTime + index,
            }, { maxRowsPerGame: 2, now: new Date('2026-06-25T00:00:00.000Z'), retentionDays: 3650 });
        }

        const history = await patchNoteHistoryManager.getHistory('league', 10);

        expect(history.map(item => item.url)).toEqual([
            'https://example.com/4',
            'https://example.com/3',
        ]);
    });

    it('prunes patch history older than the configured retention window', async () => {
        const result = await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/old',
            title: 'Old',
            content: 'old content',
            publishedAt: new Date('2026-06-20T00:00:00.000Z').getTime(),
        }, { now: new Date('2026-06-25T00:00:00.000Z'), retentionDays: 1 });

        const history = await patchNoteHistoryManager.getHistory('league', 10);

        expect(result.prunedRows).toBe(1);
        expect(history).toHaveLength(0);
    });

    it('summarizes storage usage and retention warnings by game', async () => {
        const now = new Date('2026-06-25T00:00:00.000Z');
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/1',
            title: 'Patch 1',
            content: 'abcd',
            publishedAt: new Date('2026-06-24T00:00:00.000Z').getTime(),
        }, { now, retentionDays: 3650, maxRowsPerGame: 10 });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/2',
            title: 'Patch 2',
            content: 'ef',
            publishedAt: new Date('2026-06-25T00:00:00.000Z').getTime(),
        }, { now, retentionDays: 3650, maxRowsPerGame: 10 });
        await patchNoteHistoryManager.recordPatch({
            game: 'valorant',
            url: 'https://example.com/old',
            title: 'Old',
            content: 'xyz',
            publishedAt: new Date('2026-06-01T00:00:00.000Z').getTime(),
        }, { now, retentionDays: 3650, maxRowsPerGame: 10 });

        const summary = await patchNoteHistoryManager.getStorageSummary({
            maxRowsPerGame: 1,
            now,
            retentionDays: 7,
        });

        expect(summary.totalRows).toBe(3);
        expect(summary.totalContentBytes).toBe(9);
        expect(summary.retention.retentionDays).toBe(7);
        expect(summary.warnings).toEqual(['records_exceed_retention', 'rows_exceed_max']);
        expect(summary.games).toEqual([
            expect.objectContaining({
                contentBytes: 6,
                game: 'league',
                rows: 2,
                warnings: ['rows_exceed_max'],
            }),
            expect.objectContaining({
                contentBytes: 3,
                game: 'valorant',
                rows: 1,
                warnings: ['records_exceed_retention'],
            }),
        ]);
    });

    it('lists bounded history with filters and pagination', async () => {
        const now = new Date('2026-06-25T00:00:00.000Z');
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/league-1',
            title: 'League Balance Patch',
            content: 'league content',
            publishedAt: new Date('2026-06-20T00:00:00.000Z').getTime(),
            version: '14.1',
        }, { now, retentionDays: 3650 });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/league-2',
            title: 'League Champion Patch',
            content: 'league content two',
            publishedAt: new Date('2026-06-24T00:00:00.000Z').getTime(),
            version: '14.2',
        }, { now, retentionDays: 3650 });
        await patchNoteHistoryManager.recordPatch({
            game: 'valorant',
            url: 'https://example.com/valorant-1',
            title: 'Valorant Map Patch',
            content: 'valorant content',
            publishedAt: new Date('2026-06-23T00:00:00.000Z').getTime(),
            version: '9.1',
        }, { now, retentionDays: 3650 });

        const result = await patchNoteHistoryManager.listHistory({
            fromPublishedAt: new Date('2026-06-21T00:00:00.000Z').getTime(),
            limit: 1,
            offset: 0,
            query: 'Patch',
        });

        expect(result.total).toBe(2);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].url).toBe('https://example.com/league-2');

        const gameResult = await patchNoteHistoryManager.listHistory({ game: 'valorant' });

        expect(gameResult.total).toBe(1);
        expect(gameResult.items[0].game).toBe('valorant');
    });

    it('compares two history records with a bounded line diff', async () => {
        const now = new Date('2026-06-25T00:00:00.000Z');
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/older',
            title: 'Older',
            content: [
                'Shared line',
                'Removed line',
                'Still here',
            ].join('\n'),
            publishedAt: now.getTime(),
            version: '14.1',
        }, { now, retentionDays: 3650 });
        await patchNoteHistoryManager.recordPatch({
            game: 'league',
            url: 'https://example.com/newer',
            title: 'Newer',
            content: [
                'Shared line',
                'Added line',
                'Still here',
            ].join('\n'),
            publishedAt: now.getTime() + 1000,
            version: '14.2',
        }, { now, retentionDays: 3650 });

        const history = await patchNoteHistoryManager.listHistory({ game: 'league', limit: 10 });
        const older = history.items.find(item => item.title === 'Older');
        const newer = history.items.find(item => item.title === 'Newer');
        expect(older).toBeDefined();
        expect(newer).toBeDefined();
        if (!older || !newer) throw new Error('Expected both patch history records');

        const result = await patchNoteHistoryManager.compareHistoryRecordIds(
            older.id,
            newer.id,
            { maxDiffLines: 3 }
        );

        expect(result.left).toEqual(expect.objectContaining({
            game: 'league',
            title: 'Older',
            version: '14.1',
        }));
        expect(result.right.title).toBe('Newer');
        expect(result.summary).toEqual(expect.objectContaining({
            addedLines: 1,
            removedLines: 1,
            totalDiffLines: 4,
            emittedLines: 3,
            truncated: true,
        }));
        expect(result.diff).toEqual([
            expect.objectContaining({ kind: 'unchanged', text: 'Shared line' }),
            expect.objectContaining({ kind: 'removed', text: 'Removed line' }),
            expect.objectContaining({ kind: 'added', text: 'Added line' }),
        ]);
        expect(result.left).not.toHaveProperty('content');
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
