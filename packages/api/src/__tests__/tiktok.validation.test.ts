import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectOk, expectCreated } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const base = {
    tiktokUsername: 'streamer1',
    discordChannelId: 'chan-1',
    guildId: 'testguild1'
};

describe('TikTok API validation (cooldown & quiet hours & protected fields)', () => {
    const client = givenAuthenticatedClient(app);

    beforeEach(async () => {
        await configManager.tiktokManager.removeAll();
    });

    it('accepts valid cooldown and quiet hours', async () => {
        const res = await client.post('/api/tiktok', {
            ...base,
            cooldownMinutes: 15,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:30',
            customMessage: 'Live now: {streamer}'
        });
        expect([200, 201]).toContain(res.status);
        if (res.status === 201) expectCreated(res); else expectOk(res);
    });

    it('rejects invalid quiet hours format', async () => {
        const res = await client.post('/api/tiktok', {
            ...base,
            quietHoursStart: '25:00',
            quietHoursEnd: '07:00'
        });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('rejects negative cooldownMinutes', async () => {
        const res = await client.post('/api/tiktok', {
            ...base,
            cooldownMinutes: -1
        });
        expectBadRequest(res);
    });
});
