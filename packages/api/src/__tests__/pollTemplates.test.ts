import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollTemplate } from '@zeffuro/fakegaming-common/models';
import { givenAuthenticatedClient, expectOk, expectCreated, expectNotFound, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';

const ownerId = 'poll-template-owner';
const input = { title: 'Dinner', question: 'Which food?', options: ['Pizza', 'Pasta'], durationMinutes: 10 };
const send = (client: AuthClient, method: 'patch' | 'delete', path: string, body: object) => client.raw[method](path).set('Authorization', `Bearer ${client.token}`).send(body);
beforeEach(async () => { await PollTemplate.destroy({ where: {} }); });
describe('owner saved poll API', () => {
    it('creates private defaults, edits with versions and removes only owner data', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        const saved = await owner.post('/api/pollTemplates', input); expectCreated(saved);
        expect(saved.body).toMatchObject({ ...input, hideResults: false, allowMultiple: false, ranked: false, version: 0 });
        const path = `/api/pollTemplates/${saved.body.id}`;
        expectOk(await send(owner, 'patch', path, { ...input, version: 0, hideResults: true }));
        const listed = await owner.get('/api/pollTemplates'); expectOk(listed);
        expect(listed.body[0]).toMatchObject({ hideResults: true, version: 1 });
        expect(listed.headers['cache-control']).toBe('private, no-store');
        expectConflict(await send(owner, 'delete', path, { version: 0 }));
        expectOk(await send(owner, 'delete', path, { version: 1 }));
        expect((await owner.get('/api/pollTemplates')).body).toEqual([]);
    });
    it('rejects other owners, explicit selectors, invalid settings and duplicate options', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId }); const other = givenAuthenticatedClient(app, { discordId: 'other' });
        const saved = await owner.post('/api/pollTemplates', input); const path = `/api/pollTemplates/${saved.body.id}`;
        expect((await other.get('/api/pollTemplates')).body).toEqual([]);
        expectNotFound(await send(other, 'patch', path, { ...input, version: 0 }));
        expectNotFound(await send(other, 'delete', path, { version: 0 }));
        expectBadRequest(await owner.get('/api/pollTemplates?userId=other'));
        for (const invalid of [{ ...input, ranked: true, allowMultiple: true }, { ...input, ranked: 'true' }, { ...input, options: ['A', 'ａ'] }, { ...input, options: ['A'] }, { ...input, durationMinutes: 0 }, { ...input, userId: 'other' }, { ...input, votes: [] }]) {
            expectBadRequest(await owner.post('/api/pollTemplates', invalid));
        }
        expect(await PollTemplate.count()).toBe(1);
    });
    it('round-trips ranked settings through create, owner list and versioned edits', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        const saved = await owner.post('/api/pollTemplates', { ...input, ranked: true }); expectCreated(saved);
        expect(saved.body).toMatchObject({ ranked: true, allowMultiple: false });
        expect((await owner.get('/api/pollTemplates')).body[0]).toMatchObject({ ranked: true });
        const path = `/api/pollTemplates/${saved.body.id}`;
        expectBadRequest(await send(owner, 'patch', path, { ...input, version: 0, ranked: true, allowMultiple: true }));
        expectOk(await send(owner, 'patch', path, { ...input, version: 0, ranked: false, allowMultiple: true }));
        expect((await owner.get('/api/pollTemplates')).body[0]).toMatchObject({ ranked: false, allowMultiple: true, version: 1 });
    });
    it('requires owner authentication and CSRF and localizes conflicts', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: ownerId });
        expectUnauthorized(await owner.raw.get('/api/pollTemplates'));
        vi.stubEnv('SERVICE_API_TOKEN', 'poll-service-test');
        try { expectUnauthorized(await owner.raw.get('/api/pollTemplates').set('X-Service-Token', 'poll-service-test')); }
        finally { vi.unstubAllEnvs(); }
        const service = givenAuthenticatedClient(app, { discordId: 'service:synthetic' });
        expectUnauthorized(await service.get('/api/pollTemplates'));
        const saved = await owner.post('/api/pollTemplates', input); const path = `/api/pollTemplates/${saved.body.id}`;
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await send(owner, 'delete', path, { version: 0 })); } finally { vi.unstubAllEnvs(); }
        const stale = await owner.raw.patch(path).set('Authorization', `Bearer ${owner.token}`).set('Accept-Language', 'nl').send({ ...input, version: 9 });
        expectConflict(stale); expect(stale.body.error.message).toContain('Vernieuw');
    });
});
