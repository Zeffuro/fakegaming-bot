import { describe, it, expect, beforeEach } from 'vitest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { expectBadRequest, expectCreated, expectOk } from '@zeffuro/fakegaming-common/testing';
import { givenAuthenticatedClient } from './helpers/client.js';

const base = {
    youtubeChannelId: 'UCxxxxxxxxxxxxxxxxxxxxxx',
    discordChannelId: 'chan-yt-1',
    guildId: 'testguild1'
};

describe('YouTube API validation (cooldown & quiet hours & protected fields)', () => {
    const client = givenAuthenticatedClient(app);

    beforeEach(async () => {
        await configManager.youtubeManager.removeAll();
    });

    it('accepts valid cooldown and quiet hours', async () => {
        const res = await client.post('/api/youtube', {
            ...base,
            cooldownMinutes: 10,
            quietHoursStart: '00:00',
            quietHoursEnd: '06:00',
            customMessage: 'New video: {title}'
        });
        expect([200, 201]).toContain(res.status);
        if (res.status === 201) expectCreated(res); else expectOk(res);
    });

    it('rejects invalid quiet hours format', async () => {
        const res = await client.post('/api/youtube', {
            ...base,
            quietHoursStart: '99:99',
            quietHoursEnd: '06:00'
        });
        expectBadRequest(res);
        expect(res.body.error.message).toBe('Body validation failed');
    });

    it('rejects negative cooldownMinutes', async () => {
        const res = await client.post('/api/youtube', {
            ...base,
            cooldownMinutes: -5
        });
        expectBadRequest(res);
    });

    it('rejects protected fields lastVideoId/lastNotifiedAt on create', async () => {
        const res = await client.post('/api/youtube', {
            ...base,
            lastVideoId: 'abc123',
            lastNotifiedAt: new Date().toISOString()
        } as any);
        expectBadRequest(res);
    });
});
