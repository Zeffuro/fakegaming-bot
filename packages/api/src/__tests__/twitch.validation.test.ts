import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectCreated, expectOk } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const base = {
    twitchUsername: 'streamer1',
    discordChannelId: 'chan-1',
    guildId: 'testguild1'
};

describe('Twitch API validation (cooldown & quiet hours & protected fields)', () => {
    const client = givenAuthenticatedClient(app);

    beforeEach(async () => {
        await configManager.twitchManager.removeAll();
    });

    it('accepts valid cooldown and quiet hours', async () => {
        const res = await client.post('/api/twitch', {
            ...base,
            cooldownMinutes: 15,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:30',
            customMessage: 'Live now: {streamer}'
        });
        // upsert route returns 201 Created on first insert
        expect([200, 201]).toContain(res.status);
        if (res.status === 201) expectCreated(res); else expectOk(res);
    });

    it('rejects invalid quiet hours format', async () => {
        const res = await client.post('/api/twitch', {
            ...base,
            quietHoursStart: '25:00', // invalid HH:mm
            quietHoursEnd: '07:00'
        });
        expectBadRequest(res);
        expect(res.body.error).toBe('Body validation failed');
    });

    it('rejects negative cooldownMinutes', async () => {
        const res = await client.post('/api/twitch', {
            ...base,
            cooldownMinutes: -1
        });
        expectBadRequest(res);
    });

    it('rejects protected fields isLive/lastNotifiedAt on create', async () => {
        const res = await client.post('/api/twitch', {
            ...base,
            // Intentionally sending forbidden fields; schema should reject
            isLive: true,
            lastNotifiedAt: new Date().toISOString()
        } as any);
        expectBadRequest(res);
    });
});
