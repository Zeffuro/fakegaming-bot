import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { givenAuthenticatedClient } from './helpers/client.js';
import { expectBadRequest, expectForbidden, expectOk, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';

const client = givenAuthenticatedClient(app, { discordId: 'testuser' });

describe('Guild locale config API', () => {
    beforeEach(async () => {
        await configManager.guildLocaleConfigManager.removeAll();
    });

    it('returns English for an authorized guild without creating a preference', async () => {
        const response = await client.get('/api/guildLocaleConfig').query({ guildId: 'testguild1' });

        expectOk(response);
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.body).toEqual({ guildId: 'testguild1', outputLocale: 'en' });
        await expect(configManager.guildLocaleConfigManager.getLocaleConfig('testguild1')).resolves.toBeNull();
    });

    it('allows administrators to set Dutch and validates the request body', async () => {
        const updated = await client.put('/api/guildLocaleConfig').query({ guildId: 'testguild1' }).send({ outputLocale: 'nl' });

        expectOk(updated);
        expect(updated.headers['cache-control']).toBe('private, no-store');
        expect(updated.body).toEqual({ guildId: 'testguild1', outputLocale: 'nl' });

        const invalid = await client.put('/api/guildLocaleConfig').query({ guildId: 'testguild1' }).send({ outputLocale: 'fr' });
        expectBadRequest(invalid);
    });

    it('does not disclose or update a guild outside the caller access list', async () => {
        const response = await client.get('/api/guildLocaleConfig').query({ guildId: 'unavailable-guild' });
        expectForbidden(response);
    });

    it('requires authentication for reads and writes', async () => {
        expectUnauthorized(await request(app).get('/api/guildLocaleConfig').query({ guildId: 'testguild1' }));
        expectUnauthorized(await request(app)
            .put('/api/guildLocaleConfig')
            .query({ guildId: 'testguild1' })
            .send({ outputLocale: 'nl' }));
    });
});
