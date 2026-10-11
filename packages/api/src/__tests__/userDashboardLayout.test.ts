import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDashboardLayout } from '@zeffuro/fakegaming-common/models';
import { defaultDashboardSections } from '@zeffuro/fakegaming-common/dashboard-layout';
import { givenAuthenticatedClient, expectOk, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden, type AuthClient } from '@zeffuro/fakegaming-common/testing';
import app from '../app.js';

const path = '/api/userDashboardLayout';
const input = () => ({ schemaVersion: 1, version: 0, sections: defaultDashboardSections() });
const patch = (client: AuthClient, body: object) => client.raw.patch(path).set('Authorization', `Bearer ${client.token}`).send(body);
beforeEach(async () => { await UserDashboardLayout.destroy({ where: {} }); });
describe('private dashboard layout API', () => {
    it('persists owner-only layout, resets to defaults and prevents stale replacement', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'layout-owner' });
        const other = givenAuthenticatedClient(app, { discordId: 'layout-other' });
        const first = await owner.get(path); expectOk(first); expect(first.body).toEqual(input());
        expect(first.headers['cache-control']).toBe('private, no-store');
        const value = input(); value.sections.reverse(); value.sections[0].visible = false;
        const saved = await patch(owner, value); expectOk(saved); expect(saved.body).toEqual({ ...value, version: 1 });
        expect((await other.get(path)).body).toEqual(input());
        expectConflict(await patch(owner, input()));
        expectConflict(await owner.post(`${path}/reset`, { version: 0 }));
        const reset = await owner.post(`${path}/reset`, { version: 1 }); expectOk(reset); expect(reset.body).toEqual({ ...input(), version: 2 });
    });
    it('strictly rejects owner selectors and invalid schemas without writing', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'layout-owner' }); const value = input();
        expectBadRequest(await owner.get(`${path}?userId=other`));
        for (const invalid of [{ ...value, userId: 'other' }, { ...value, schemaVersion: 2 }, { ...value, version: -1 },
            { ...value, sections: value.sections.slice(1) }, { ...value, sections: [...value.sections.slice(1), value.sections[1]] },
            { ...value, sections: [{ id: 'unsupported', visible: true }, ...value.sections.slice(1)] },
            { ...value, sections: [{ id: 'today', visible: 'true' }, ...value.sections.slice(1)] }]) expectBadRequest(await patch(owner, invalid));
        expectBadRequest(await owner.post(`${path}/reset`, { version: 0, userId: 'other' }));
        expect(await UserDashboardLayout.count()).toBe(0);
    });
    it('requires real owner authentication and CSRF and returns localized stale errors', async () => {
        const owner = givenAuthenticatedClient(app, { discordId: 'layout-owner' });
        expectUnauthorized(await owner.raw.get(path));
        const service = givenAuthenticatedClient(app, { discordId: 'service:synthetic' }); expectUnauthorized(await service.get(path));
        vi.stubEnv('SERVICE_API_TOKEN', 'layout-service-test');
        try { expectUnauthorized(await owner.raw.get(path).set('X-Service-Token', 'layout-service-test')); }
        finally { vi.unstubAllEnvs(); }
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(owner, input())); expectForbidden(await owner.post(`${path}/reset`, { version: 0 })); }
        finally { vi.unstubAllEnvs(); }
        for (const [locale, word] of [['en', 'elsewhere'], ['nl', 'elders']]) {
            const stale = await owner.raw.patch(path).set('Authorization', `Bearer ${owner.token}`).set('Accept-Language', locale).send({ ...input(), version: 9 });
            expectConflict(stale); expect(stale.body.error.message).toContain(word);
        }
    });
});
