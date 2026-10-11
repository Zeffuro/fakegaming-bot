import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalNotificationPause, UserConfig } from '@zeffuro/fakegaming-common/models';
import { givenAuthenticatedClient, expectOk, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';
const path = '/api/userNotificationPause';
const input = { enabled: true, resumeAt: null, timezone: 'Europe/Amsterdam', version: 0 };
const patch = (client: AuthClient, body: object) => client.raw.patch(path).set('Authorization', `Bearer ${client.token}`).send(body);
beforeEach(async () => {
    await PersonalNotificationPause.destroy({ where: {} });
    await UserConfig.findOrCreate({ where: { discordId: 'pause-api-owner' }, defaults: { discordId: 'pause-api-owner' } });
    await UserConfig.update({ timezone: 'Europe/Amsterdam' }, { where: { discordId: 'pause-api-owner' } });
});
describe('private personal notification pause API', () => {
    it('stores owner pause independently and resumes without rewriting individual preferences', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'pause-api-owner' }); const other = givenAuthenticatedClient(app, { discordId: 'pause-api-other' });
        const value = await owner.get(path); expectOk(value); expect(value.body).toEqual({ ...input, enabled: false });
        expect(value.headers['cache-control']).toBe('private, no-store');
        expectOk(await patch(owner, input)); expect((await other.get(path)).body.enabled).toBe(false);
        expectConflict(await patch(owner, { ...input, enabled: false }));
        expectOk(await patch(owner, { ...input, enabled: false, version: 1 }));
        expect((await owner.get(path)).body).toEqual({ ...input, enabled: false, version: 2 });
    });
    it('rejects selectors, stale saved timezones and invalid exact resume times', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'pause-api-owner' });
        expectBadRequest(await owner.get(`${path}?userId=other`));
        expectConflict(await patch(owner, { ...input, timezone: 'UTC' }));
        for (const invalid of [{ ...input, userId: 'other' }, { ...input, resumeAt: '1h' }, { ...input, resumeAt: '2020-01-01T12:00' },
            { ...input, enabled: 'true' }, { ...input, version: -1 }]) expectBadRequest(await patch(owner, invalid));
        expect(await PersonalNotificationPause.count()).toBe(0);
    });
    it('requires owner authentication and CSRF, rejects service callers and localizes stale conflicts', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'pause-api-owner' });
        expectUnauthorized(await owner.raw.get(path));
        expectUnauthorized(await givenAuthenticatedClient(app, { discordId: 'service:synthetic' }).get(path));
        vi.stubEnv('SERVICE_API_TOKEN', 'pause-service-test');
        try { expectUnauthorized(await owner.raw.get(path).set('X-Service-Token', 'pause-service-test')); } finally { vi.unstubAllEnvs(); }
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(owner, input)); } finally { vi.unstubAllEnvs(); }
        for (const [locale, word] of [['en', 'timezone'], ['nl', 'tijdzone']]) {
            const response = await owner.raw.patch(path).set('Authorization', `Bearer ${owner.token}`).set('Accept-Language', locale).send({ ...input, version: 9 });
            expectConflict(response); expect(response.body.error.message).toContain(word);
        }
    });
});
