import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { CalendarConnection, CalendarSource, MorningBriefingDelivery, MorningBriefingSettings, PersonalSchedule, ScheduleOccurrence, UserConfig, UserTask } from '@zeffuro/fakegaming-common/models';
import { MorningBriefingManager, UserTaskManager, UserScheduleManager } from '@zeffuro/fakegaming-common/managers';
import { givenAuthenticatedClient, expectOk, expectBadRequest, expectUnauthorized, expectConflict, expectForbidden } from '@zeffuro/fakegaming-common/testing';
import type { PersonalToday } from '@zeffuro/fakegaming-common/api';
import app from '../app.js';
import { configManager as cm } from '../vitest.setup.js';
import { processMorningBriefings } from '../jobs/morningBriefings.js';
import { formatMorningBriefing } from '../personalToday/morningBriefing.js';

const send = vi.hoisted(() => vi.fn());
vi.mock('../utils/discord.js', () => ({ sendDirectMessagePayloadResult: send }));
const manager = new MorningBriefingManager();
const userId = 'briefing-owner';
const morning = Date.parse('2026-10-10T07:00:00Z');
const previous = { tasks: cm.userTaskManager, schedules: cm.userScheduleManager };
let current = morning;
const enable = () => manager.configure(userId, { enabled: true, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 });
const task = (title = 'Private task') => cm.userTaskManager.create({ userId, title, timezone: 'Europe/Amsterdam' });

beforeEach(async () => {
    vi.clearAllMocks(); current = morning; vi.spyOn(Date, 'now').mockImplementation(() => current);
    send.mockResolvedValue({ status: 'sent', messageId: 'message' });
    cm.userTaskManager = new UserTaskManager(() => current); cm.userScheduleManager = new UserScheduleManager(() => current);
    await MorningBriefingDelivery.destroy({ where: {} }); await MorningBriefingSettings.destroy({ where: {} });
    await ScheduleOccurrence.destroy({ where: {} }); await PersonalSchedule.destroy({ where: {} });
    await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
    await UserTask.destroy({ where: {} }); await cm.reminderManager.removeAll(); await cm.userManager.removeAll();
    await UserConfig.create({ discordId: userId, timezone: 'Europe/Amsterdam', preferredLocale: 'nl' });
});
afterEach(() => { cm.userTaskManager = previous.tasks; cm.userScheduleManager = previous.schedules; });

describe('private morning briefing API and scheduled job', () => {
    it('starts disabled, previews privately in saved output locale and requires strict owner inputs', async () => {
        const client = givenAuthenticatedClient(app, { discordId: userId }); await task();
        const settings = await client.get('/api/morningBriefings'); expectOk(settings);
        expect(settings.body).toEqual({ enabled: false, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 });
        const preview = await client.get('/api/morningBriefings/preview'); expectOk(preview);
        expect(preview.headers['cache-control']).toBe('private, no-store');
        expect(preview.body).toMatchObject({ empty: false, total: 1, included: 1, omitted: 0 });
        expect(preview.body.content).toContain('Je ochtendoverzicht'); expect(send).not.toHaveBeenCalled();
        expectUnauthorized(await client.raw.get('/api/morningBriefings/preview'));
        expectBadRequest(await client.get('/api/morningBriefings/preview?userId=other'));
        expectBadRequest(await client.raw.patch('/api/morningBriefings').set('Authorization', `Bearer ${client.token}`)
            .send({ enabled: true, localTime: '24:00', timezone: 'Europe/Amsterdam', version: 0 }));
    });
    it('rejects service identities, unsafe selectors, stale timezone and missing browser CSRF', async () => {
        const client = givenAuthenticatedClient(app, { discordId: userId });
        const body = { enabled: true, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 };
        const patch = (value: object) => client.raw.patch('/api/morningBriefings').set('Authorization', `Bearer ${client.token}`).send(value);
        expectBadRequest(await patch({ ...body, userId: 'other' })); expectConflict(await patch({ ...body, timezone: 'UTC' }));
        vi.stubEnv('SERVICE_API_TOKEN', 'briefing-service-token');
        try {
            expectUnauthorized(await client.raw.get('/api/morningBriefings').set('x-service-token', 'briefing-service-token'));
            expectUnauthorized(await givenAuthenticatedClient(app, { discordId: 'service:forged' }).get('/api/morningBriefings/preview'));
        } finally { vi.unstubAllEnvs(); }
        vi.stubEnv('ENABLE_CSRF_TESTS', '1');
        try { expectForbidden(await patch(body)); } finally { vi.unstubAllEnvs(); }
        expectOk(await patch(body)); expectConflict(await patch(body));
    });
    it('processes actual managers without nested transaction deadlock and sends once per local day', async () => {
        await task('Morning checklist'); await enable();
        expect(await processMorningBriefings(morning)).toEqual({ sent: 1, skipped: 0, errors: 0 });
        expect(send).toHaveBeenCalledWith(userId, expect.objectContaining({ content: expect.stringContaining('Morning checklist'), allowed_mentions: { parse: [] } }));
        expect(await processMorningBriefings(morning)).toEqual({ sent: 0, skipped: 0, errors: 0 }); expect(send).toHaveBeenCalledOnce();
        expect(await MorningBriefingDelivery.findOne({ where: { userId } })).toMatchObject({ status: 'sent', localDate: '2026-10-10' });
    });
    it('skips empty days and excludes foreign tasks and disabled imported occurrences', async () => {
        await enable(); await cm.userTaskManager.create({ userId: 'other', title: 'Foreign', timezone: 'UTC' });
        const source = await CalendarSource.create({ id: randomUUID(), userId, calendarId: 'calendar', label: 'Private', timezone: 'UTC', titleFilter: null, enabled: false, version: 1, lastSyncedAt: current });
        await CalendarConnection.create({ userId, status: 'connected', version: 1, encryptedAccessToken: null, encryptedRefreshToken: null, expiresAt: 0 });
        const occurrence = await cm.userScheduleManager.createManual({ userId, title: 'Stopped imported', plannedAt: current + 60_000, timezone: 'UTC' });
        await PersonalSchedule.update({ sourceId: source.id }, { where: { id: occurrence.scheduleId } });
        expect(await processMorningBriefings(current)).toEqual({ sent: 0, skipped: 1, errors: 0 }); expect(send).not.toHaveBeenCalled();
        await task('Added later'); expect((await processMorningBriefings(current)).sent).toBe(0); expect(send).not.toHaveBeenCalled();
    });
    it('retries rejected delivery safely and leaves uncertain delivery permanently bound', async () => {
        await task(); await enable(); send.mockResolvedValueOnce({ status: 'rejected' });
        expect((await processMorningBriefings(current)).errors).toBe(1);
        expect((await processMorningBriefings(current)).sent).toBe(0); expect(send).toHaveBeenCalledOnce();
        current += 60_000; send.mockResolvedValueOnce({ status: 'unknown' });
        expect((await processMorningBriefings(current)).errors).toBe(1); current += 360_000;
        expect((await processMorningBriefings(current)).sent).toBe(0); expect(send).toHaveBeenCalledTimes(2);
        expect(await MorningBriefingDelivery.findOne({ where: { userId } })).toMatchObject({ status: 'uncertain' });
    });
    it('suppresses a prepared payload when saved preferences change during its reads', async () => {
        await task(); await enable(); const original = cm.userTaskManager.list.bind(cm.userTaskManager);
        const list = vi.spyOn(cm.userTaskManager, 'list').mockImplementationOnce(async ownerId => {
            await manager.configure(userId, { enabled: false, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 1 });
            return original(ownerId);
        });
        try { expect((await processMorningBriefings(current)).skipped).toBe(1); expect(send).not.toHaveBeenCalled(); }
        finally { list.mockRestore(); }
    });
    it('retries preparation failures without an external send attempt', async () => {
        await task(); await enable(); const list = vi.spyOn(cm.userTaskManager, 'list').mockRejectedValueOnce(new Error('Storage unavailable'));
        try { expect((await processMorningBriefings(current)).errors).toBe(1); expect(send).not.toHaveBeenCalled(); }
        finally { list.mockRestore(); }
        current += 60_000; expect((await processMorningBriefings(current)).sent).toBe(1); expect(send).toHaveBeenCalledOnce();
    });
});

describe('bounded briefing content', () => {
    const agenda = (): Omit<PersonalToday, 'session'> => ({ now: morning, day: '2026-10-10', timezone: 'Europe/Amsterdam', tasks: [], reminders: [], schedules: [], countdowns: [] });
    it.each(['en', 'nl'] as const)('counts every omitted item and preserves Discord bounds in %s', locale => {
        const value = agenda(); value.reminders = Array.from({ length: 200 }, (_, index) => ({ id: `${index}`, title: `Private ${index} ${'*'.repeat(180)}`, dueAt: morning }));
        const result = formatMorningBriefing(value, locale);
        expect(result.content.length).toBeLessThanOrEqual(1900); expect(result.total).toBe(200);
        expect(result.included + result.omitted).toBe(200); expect(result.omitted).toBeGreaterThan(0);
        expect(result.content).toContain(String(result.omitted)); expect(result.content).not.toContain('Private 199');
        expect(result.content).toContain('\\*');
    });
    it('marks empty previews and uses local saved-zone dates instead of UTC dates', () => {
        expect(formatMorningBriefing(agenda(), 'en')).toMatchObject({ empty: true, total: 0, included: 0, omitted: 0 });
        const value = agenda(); value.reminders = [{ id: 'one', title: '<@123>\n*Hello*', dueAt: Date.parse('2026-10-09T22:15:00Z') }];
        const preview = formatMorningBriefing(value, 'en'); expect(preview.content).toContain('00:15');
        expect(preview.content).not.toContain('Overdue'); expect(preview.content).not.toContain('<@123>');
    });
    it('retains provider calendar dates for all-day overdue labels', () => {
        const value = agenda(); value.schedules = [{ id: 'all-day', title: 'Tokyo event', plannedAt: Date.parse('2026-10-09T15:00:00Z'),
            endAt: null, allDay: true, timezone: 'Asia/Tokyo', version: 0, nextNotifyAt: null }];
        expect(formatMorningBriefing(value, 'en').content).not.toContain('Overdue');
        value.schedules[0]!.plannedAt -= 86_400_000;
        expect(formatMorningBriefing(value, 'en').content).toContain('All day · Overdue');
    });
});
