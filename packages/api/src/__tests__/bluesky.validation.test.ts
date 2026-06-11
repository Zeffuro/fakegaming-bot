import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectCreated, expectOk } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const base = {
    blueskyHandle: 'bsky.app',
    discordChannelId: 'chan-1',
    guildId: 'testguild1'
};

describe('Bluesky API validation', () => {
    const client = givenAuthenticatedClient(app);

    beforeEach(async () => {
        await configManager.blueskyManager.removeAll();
    });

    it('accepts valid cooldown and quiet hours', async () => {
        const res = await client.post('/api/bluesky', {
            ...base,
            cooldownMinutes: 15,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:30',
            customMessage: 'New post from {author}: {url}'
        });
        expect([200, 201]).toContain(res.status);
        if (res.status === 201) expectCreated(res); else expectOk(res);
    });

    it('rejects invalid quiet hours format', async () => {
        const res = await client.post('/api/bluesky', {
            ...base,
            quietHoursStart: '25:00',
            quietHoursEnd: '07:00'
        });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('rejects negative cooldownMinutes', async () => {
        const res = await client.post('/api/bluesky', {
            ...base,
            cooldownMinutes: -1
        });
        expectBadRequest(res);
    });

    it('rejects protected fields on create', async () => {
        const res = await client.post('/api/bluesky', {
            ...base,
            lastPostUri: 'at://did:plc:test/app.bsky.feed.post/abc',
            lastPostCid: 'cid',
            lastNotifiedAt: new Date().toISOString()
        } as never);
        expectBadRequest(res);
    });
});
