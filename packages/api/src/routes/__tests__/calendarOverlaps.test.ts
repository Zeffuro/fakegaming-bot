import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnection, CalendarSource, CalendarEventSnapshot } from '@zeffuro/fakegaming-common/models';
import { expectBadRequest, expectOk, expectServiceUnavailable, expectUnauthorized } from '@zeffuro/fakegaming-common/testing';
import type { AuthenticatedRequest } from '../../types/express.js';
import { router } from '../calendarOverlaps.js';

const userId = 'overlap-owner';
const otherId = 'overlap-other';
const app = express();
app.use((req, _res, next) => {
    if (!req.headers['x-anonymous']) (req as AuthenticatedRequest).user = { discordId: req.headers['x-service-owner'] ? 'service:bot' : userId, username: 'Owner' };
    next();
});
app.use('/overlaps', router);
const forwarded = vi.fn();
const onError: ErrorRequestHandler = (error, _req, res, _next) => { forwarded(error); res.status(500).end(); };
app.use(onError);

async function source(owner = userId, enabled = true, calendarId: string = randomUUID(), lastSyncedAt: number | null = Date.now()) {
    return CalendarSource.create({ id: randomUUID(), userId: owner, calendarId, label: 'Calendar label', timezone: 'Europe/Amsterdam', enabled, lastSyncedAt });
}
async function snapshot(source: CalendarSource, eventId: string = randomUUID(), extra: Record<string, unknown> = {}) {
    return CalendarEventSnapshot.create({ id: randomUUID(), sourceId: source.id, userId: source.userId, scheduleId: randomUUID(), eventId,
        title: 'Private title', timezone: 'Europe/Amsterdam', plannedAt: Date.now() + 3600_000, endAt: Date.now() + 7200_000,
        allDay: false, cancelled: false, ...extra });
}

describe('owner calendar overlap API', () => {
    beforeEach(async () => {
        vi.restoreAllMocks(); forwarded.mockClear();
        for (const owner of [userId, otherId]) {
            await CalendarEventSnapshot.destroy({ where: { userId: owner } });
            await CalendarSource.destroy({ where: { userId: owner } });
            await CalendarConnection.destroy({ where: { userId: owner } });
        }
        await CalendarConnection.create({ userId, status: 'connected', encryptedAccessToken: 'secret-access', encryptedRefreshToken: 'secret-refresh' });
    });
    it('enforces a browser owner, rejects owner selectors and all invalid pagination', async () => {
        expectUnauthorized(await request(app).get('/overlaps').set('x-anonymous', '1'));
        expectUnauthorized(await request(app).get('/overlaps').set('x-service-owner', '1'));
        for (const query of ['userId=other', 'limit=0', 'limit=101', 'limit=1&limit=2', 'offset=-1', 'offset=1.5', 'offset=1000000000']) {
            expectBadRequest(await request(app).get(`/overlaps?${query}`));
        }
    });
    it('isolates owners and active imported sources, counts every pair and exposes no provider credentials', async () => {
        const active = await source();
        const stopped = await source(userId, false);
        const foreign = await source(otherId);
        const unsynced = await source(userId, true, randomUUID(), null);
        for (let index = 0; index < 4; index += 1) await snapshot(active);
        await snapshot(stopped); await snapshot(foreign); await snapshot(unsynced);
        const first = await request(app).get('/overlaps?offset=0&limit=2');
        expectOk(first); expect(first.headers['cache-control']).toBe('private, no-store');
        expect(first.body.total).toBe(6); expect(first.body.overlaps).toHaveLength(2);
        expect(first.body.sources).toHaveLength(2); expect(first.text).not.toContain('secret-');
        expect(first.text).not.toContain(otherId); expect(first.text).not.toContain(active.calendarId);
        const second = await request(app).get('/overlaps?offset=2&limit=2');
        const last = await request(app).get('/overlaps?offset=4&limit=2');
        const identities = [first, second, last].flatMap(response => response.body.overlaps.map((pair: { first: { id: string }; second: { id: string } }) => `${pair.first.id}:${pair.second.id}`));
        expect(new Set(identities).size).toBe(6);
        await CalendarConnection.update({ status: 'disconnected' }, { where: { userId } });
        const disconnected = await request(app).get('/overlaps');
        expect(disconnected.body).toMatchObject({ connected: false, overlaps: [], sources: [], total: 0 });
    });
    it('suppresses same-calendar filtered duplicates and the freshest cancelled provider event', async () => {
        const older = await source(userId, true, 'same-calendar', 100);
        const newer = await source(userId, true, 'same-calendar', 200);
        await snapshot(older, 'same-event'); await snapshot(newer, 'same-event');
        expect((await request(app).get('/overlaps')).body.total).toBe(0);
        await snapshot(older, 'different-event');
        expect((await request(app).get('/overlaps')).body.total).toBe(1);
        await CalendarEventSnapshot.update({ cancelled: true }, { where: { sourceId: newer.id } });
        expect((await request(app).get('/overlaps')).body.total).toBe(0);
    });
    it('contains private database failure details instead of forwarding them', async () => {
        vi.spyOn(CalendarConnection, 'findByPk').mockRejectedValueOnce(new Error('private SQL secret'));
        const result = await request(app).get('/overlaps');
        expectServiceUnavailable(result); expect(result.text).not.toContain('private SQL secret');
        expect(result.body.error.code).toBe('CALENDAR_OVERLAPS_UNAVAILABLE'); expect(forwarded).not.toHaveBeenCalled();
    });
});
