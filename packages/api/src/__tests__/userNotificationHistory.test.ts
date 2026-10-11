import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalNotificationHistory } from '@zeffuro/fakegaming-common/models';
import { PersonalNotificationHistoryManager } from '@zeffuro/fakegaming-common/managers';
import { givenAuthenticatedClient, expectOk, expectBadRequest, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';

const path = '/api/userNotificationHistory';
const manager = new PersonalNotificationHistoryManager();
const ownerId = 'history-api-owner';
beforeEach(async () => { await PersonalNotificationHistory.destroy({ where: {} }); });

describe('private notification history API', () => {
    it('returns only the authenticated owner and exposes safe delivery details', async () => {
        const now = Date.now();
        await manager.record({ userId: ownerId, kind: 'reminder', occurrenceKey: 'private-key', title: 'My reminder', status: 'sent', scheduledAt: now,
            messageId: '123456789012345678', channelId: '234567890123456789' });
        await manager.record({ userId: 'history-api-other', kind: 'anime', occurrenceKey: 'other-key', title: 'Other private title', status: 'delayed', reason: 'paused', scheduledAt: now });
        const response = await givenAuthenticatedClient(app, { discordId: ownerId }).get(path);
        expectOk(response); expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.body).toMatchObject({ total: 1, offset: 0, limit: 20, retentionDays: 90 });
        expect(response.body.items[0]).toMatchObject({ title: 'My reminder', kind: 'reminder', status: 'sent', messageUrl: 'https://discord.com/channels/@me/234567890123456789/123456789012345678' });
        expect(Object.keys(response.body.items[0]).sort()).toEqual(['id', 'kind', 'messageUrl', 'reason', 'scheduledAt', 'sentAt', 'status', 'title', 'updatedAt'].sort());
        expect(JSON.stringify(response.body)).not.toContain('private-key'); expect(JSON.stringify(response.body)).not.toContain('Other private title');
    });
    it('filters before paging and keeps uncertainty distinct from confirmed delivery', async () => {
        const now = Date.now();
        for (const [occurrenceKey, kind, status] of [['one', 'digest', 'uncertain'], ['two', 'digest', 'uncertain'], ['three', 'reminder', 'sent']] as const) {
            await manager.record({ userId: ownerId, occurrenceKey, title: occurrenceKey, kind, status, scheduledAt: now, reason: status === 'uncertain' ? 'unknown' : null });
        }
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        const first = await owner.get(`${path}?kind=digest&status=uncertain&limit=1`);
        const next = await owner.get(`${path}?kind=digest&status=uncertain&limit=1&offset=1`);
        expectOk(first); expectOk(next); expect(first.body.total).toBe(2); expect(next.body.total).toBe(2);
        expect(next.body.items[0].id).not.toBe(first.body.items[0].id);
        expect(first.body.items[0]).toMatchObject({ status: 'uncertain', reason: 'unknown', sentAt: null, messageUrl: null });
    });
    it('rejects foreign selectors, duplicate filters and unbounded pagination', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        for (const query of ['userId=other', 'kind=public', 'status=delivered', 'kind=anime&kind=digest', 'offset=-1', 'offset=1001', 'limit=0', 'limit=101', 'offset=1.5']) {
            expectBadRequest(await owner.get(`${path}?${query}`));
        }
    });
    it('requires owner authentication and rejects service callers', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        expectUnauthorized(await owner.raw.get(path));
        expectUnauthorized(await givenAuthenticatedClient(app, { discordId: 'service:synthetic' }).get(path));
        vi.stubEnv('SERVICE_API_TOKEN', 'history-service-test');
        try { expectUnauthorized(await owner.raw.get(path).set('X-Service-Token', 'history-service-test')); }
        finally { vi.unstubAllEnvs(); }
    });
    it('does not invent historical sends for an account without recorded notifications', async () => {
        const response = await givenAuthenticatedClient(app, { discordId: ownerId }).get(path);
        expectOk(response); expect(response.body.items).toEqual([]); expect(response.body.total).toBe(0);
    });
});
