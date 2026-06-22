import { beforeEach, describe, expect, it } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectOk, expectUnauthorized, givenAuthenticatedClient, type AuthClient } from '@zeffuro/fakegaming-common/testing';

function patch(client: AuthClient, path: string, body: Record<string, unknown>) {
    return client.raw.patch(path).set('Authorization', `Bearer ${client.token}`).send(body);
}

describe('User settings API', () => {
    beforeEach(async () => {
        await configManager.userManager.removeAll();
    });

    it('reads and updates settings for the authenticated user', async () => {
        await configManager.userManager.setUser({
            discordId: 'settings-user',
            timezone: 'UTC',
            defaultReminderTimeSpan: '1h',
        });
        const client = givenAuthenticatedClient(app, { discordId: 'settings-user' });

        const current = await client.get('/api/userSettings');
        expectOk(current);
        expect(current.body).toMatchObject({
            discordId: 'settings-user',
            timezone: 'UTC',
            defaultReminderTimeSpan: '1h',
        });

        const updated = await patch(client, '/api/userSettings', {
            timezone: 'Europe/Amsterdam',
            defaultReminderTimeSpan: '2h',
        });
        expectOk(updated);
        expect(updated.body).toMatchObject({
            discordId: 'settings-user',
            timezone: 'Europe/Amsterdam',
            defaultReminderTimeSpan: '2h',
        });

        const stored = await configManager.userManager.getOnePlain({ discordId: 'settings-user' });
        expect(stored).toMatchObject({
            timezone: 'Europe/Amsterdam',
            defaultReminderTimeSpan: '2h',
        });
    });

    it('does not expose another user settings record', async () => {
        await configManager.userManager.setUser({
            discordId: 'owner-user',
            timezone: 'Europe/Berlin',
            defaultReminderTimeSpan: '45m',
        });
        const other = givenAuthenticatedClient(app, { discordId: 'other-user' });

        const current = await other.get('/api/userSettings');
        expectOk(current);
        expect(current.body).toMatchObject({
            discordId: 'other-user',
            timezone: null,
            defaultReminderTimeSpan: null,
        });
    });

    it('creates settings on first save, validates updates, and requires authentication', async () => {
        const client = givenAuthenticatedClient(app, { discordId: 'missing-user' });

        const created = await patch(client, '/api/userSettings', { timezone: 'UTC' });
        expectOk(created);
        expect(created.body).toMatchObject({
            discordId: 'missing-user',
            timezone: 'UTC',
            defaultReminderTimeSpan: null,
        });

        expectBadRequest(await patch(client, '/api/userSettings', {}));
        expectUnauthorized(await client.raw.get('/api/userSettings'));
    });
});
