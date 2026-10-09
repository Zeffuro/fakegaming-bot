import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnection, CalendarSource, CalendarPublication, CalendarPublicationDraft, CalendarPublicationDelivery,
    PersonalSchedule, ScheduleOccurrence, CalendarEventSnapshot, CalendarEventSnapshotState } from '@zeffuro/fakegaming-common/models';
import { expectOk, expectCreated, expectUnauthorized, expectNotFound, expectBadRequest, expectConflict, expectForbidden, expectServiceUnavailable } from '@zeffuro/fakegaming-common/testing';
import { configManager } from '../vitest.setup.js';
import { disconnectCalendar } from '../googleCalendar/auth.js';
import type { AuthenticatedRequest } from '../types/express.js';
const destination = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock('./discord.js', () => ({ validatePublicationDestination: destination.validate,
    CalendarPublishDiscordError: class extends Error { constructor(public code: string) { super(code); } } }));
import { calendarPublishingRouter } from './routes.js';
import { previewPublication, confirmPublication, type PublicationInput } from './configuration.js';

const userId = '123456789012345678';
const otherUser = '223456789012345678';
const sourceId = randomUUID();
const now = Date.UTC(2026, 9, 9, 8);
const input: PublicationInput = { sourceId, guildId: '323456789012345678', channelId: '423456789012345678', lookaheadDays: 180, eventLeadDays: null, publicTitle: null, includeEventDetails: false };
const event = { seriesKey: 'medicine', occurrenceKey: 'first', eventId: 'google-private-id', title: 'Synthetic medicine', timezone: 'Europe/Amsterdam',
    plannedAt: now + 25 * 86_400_000, endAt: now + 25 * 86_400_000 + 3_600_000, allDay: false, cancelled: false };
let actor: string | null = userId;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { if (actor) (req as AuthenticatedRequest).user = { discordId: actor, username: 'Owner' }; next(); });
app.use('/publish', calendarPublishingRouter);

async function seedEvents(events = [event]) {
    await configManager.userScheduleManager.syncSource(sourceId, userId, events, now - 1000, now + 366 * 86_400_000, now, 1);
}
async function confirmBody(value = input) {
    const preview = await request(app).post('/publish/preview').send(value);
    expectOk(preview);
    return { draftId: preview.body.draftId, acknowledgeChannel: true, acknowledgeServerEvents: value.eventLeadDays !== null, confirmChannelName: 'reminders' };
}

describe('calendar publishing privacy and preview confirmation', () => {
    beforeEach(async () => {
        vi.restoreAllMocks(); vi.clearAllMocks(); actor = userId; vi.spyOn(Date, 'now').mockReturnValue(now);
        await CalendarPublicationDelivery.destroy({ where: {} }); await CalendarPublicationDraft.destroy({ where: {} });
        await CalendarEventSnapshot.destroy({ where: {} }); await CalendarEventSnapshotState.destroy({ where: {} });
        await CalendarPublication.destroy({ where: {} }); await ScheduleOccurrence.destroy({ where: {} });
        await PersonalSchedule.destroy({ where: {} }); await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
        await CalendarConnection.create({ userId, status: 'connected', version: 1 });
        await CalendarSource.create({ id: sourceId, userId, calendarId: 'private@email.example', label: 'Private', timezone: event.timezone, titleFilter: 'medicine', enabled: true, version: 1 });
        destination.validate.mockResolvedValue({ guildName: 'My server', channelName: 'reminders' });
        await seedEvents();
    });
    it('previews future data with no public configuration or sensitive fields, then enables once', async () => {
        const preview = await request(app).post('/publish/preview').send(input);
        expectOk(preview); expect(preview.body.count).toBe(1); expect(preview.body.eventCount).toBe(0);
        expect(preview.body.events[0]).toMatchObject({ title: event.title, plannedAt: event.plannedAt, endAt: event.endAt, timezone: event.timezone, allDay: false, discordEvent: null,
            htmlLink: null, location: null, description: null, duration: '1 hour',
            channelMessage: { title: event.title, url: null, duration: '1 hour', location: null, description: null } });
        expect(preview.text).not.toContain('private@email'); expect(preview.text).not.toContain('google-private-id');
        expect(await CalendarPublication.count()).toBe(0); expect(await CalendarPublicationDelivery.count()).toBe(0);
        const body = { draftId: preview.body.draftId, acknowledgeChannel: true, acknowledgeServerEvents: false, confirmChannelName: 'reminders' };
        const result = await request(app).post('/publish/confirm').send(body);
        expectCreated(result); expect(result.body.publication).toMatchObject({ enabled: true, eventLeadDays: null, uncertainCount: 0 });
        expectConflict(await request(app).post('/publish/confirm').send(body));
        expect(destination.validate).toHaveBeenCalledTimes(2);
    });
    it('keeps old callers private and confirms only exact reviewed detail settings', async () => {
        await CalendarEventSnapshot.update({ htmlLink: 'https://www.google.com/calendar/event?eid=synthetic', location: 'Clinic', description: 'Provider description' }, { where: { userId } });
        const { includeEventDetails: _details, ...legacy } = input;
        const preview = await request(app).post('/publish/preview').send(legacy);
        expectOk(preview); expect(preview.body.includeEventDetails).toBe(false);
        expect(preview.body.events[0].channelMessage).toMatchObject({ url: null, location: null, description: null });
        const confirmation = { draftId: preview.body.draftId, acknowledgeChannel: true, acknowledgeServerEvents: false, confirmChannelName: 'reminders' };
        expectBadRequest(await request(app).post('/publish/confirm').send({ ...confirmation, includeEventDetails: true }));
        expectCreated(await request(app).post('/publish/confirm').send(confirmation));
        expect((await CalendarPublication.findOne())?.includeEventDetails).toBe(false);
    });
    it('previews exact approved channel and Event details and invalidates detail changes', async () => {
        await CalendarEventSnapshot.update({ htmlLink: 'https://www.google.com/calendar/event?eid=synthetic', location: 'Clinic [A]', description: 'Read *instructions* @everyone' }, { where: { userId } });
        const settings = { ...input, includeEventDetails: true, eventLeadDays: 30, publicTitle: 'Appointment' };
        const preview = await previewPublication(userId, settings, now);
        expect(preview.includeEventDetails).toBe(true);
        expect(preview.events[0].channelMessage).toEqual({ title: 'Appointment', url: 'https://www.google.com/calendar/event?eid=synthetic',
            duration: '1 hour', location: 'Clinic \\[A\\]', description: 'Read \\*instructions\\* @\u200beveryone' });
        expect(preview.events[0].discordEvent).toMatchObject({ name: 'Appointment', location: 'Clinic [A]', description: 'Read \\*instructions\\* @\u200beveryone' });
        expect(JSON.stringify(preview)).not.toContain(event.title);
        await CalendarEventSnapshot.update({ description: 'Changed instructions' }, { where: { userId } });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', true, now)).rejects.toMatchObject({ code: 'stale_preview' });
        const fresh = await previewPublication(userId, settings, now);
        await expect(confirmPublication(userId, fresh.draftId, 'reminders', true, now)).resolves.toMatchObject({ includeEventDetails: true });
    });
    it('requires a real authenticated calendar owner before guild lookups or data access', async () => {
        actor = null; expectUnauthorized(await request(app).get('/publish'));
        actor = otherUser; expectNotFound(await request(app).post('/publish/preview').send(input));
        expect(destination.validate).not.toHaveBeenCalled();
        const body = await (async () => { actor = userId; return confirmBody(); })();
        actor = otherUser; expectConflict(await request(app).post('/publish/confirm').send(body));
        expect((await request(app).get('/publish')).body).toEqual({ publications: [] });
    });
    it('requires checkbox and exact channel name; body cannot change reviewed destination', async () => {
        const body = await confirmBody();
        expectBadRequest(await request(app).post('/publish/confirm').send({ ...body, acknowledgeChannel: false }));
        expectBadRequest(await request(app).post('/publish/confirm').send({ ...body, guildId: otherUser }));
        expectConflict(await request(app).post('/publish/confirm').send({ ...body, confirmChannelName: 'general' }));
        expect(await CalendarPublication.count()).toBe(0);
    });
    it('requires independent event acknowledgment and applies public title before preview', async () => {
        const settings = { ...input, eventLeadDays: 30, publicTitle: 'Personal appointment' };
        const preview = await previewPublication(userId, settings, now);
        expect(preview.eventCount).toBe(1); expect(preview.events[0].title).toBe(settings.publicTitle);
        expect(JSON.stringify(preview)).not.toContain(event.title);
        expect(preview.events[0].discordEvent).toMatchObject({ name: settings.publicTitle, plannedAt: event.plannedAt, endAt: event.endAt,
            location: 'Calendar reminder', description: 'Imported calendar date. Personal reminders and completion history remain private.' });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'stale_preview' });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', true, now)).resolves.toMatchObject({ eventLeadDays: 30, publicTitle: settings.publicTitle });
    });
    it('rejects expired, changed, renamed, paused, disconnected, unsynced and replaced previews', async () => {
        let preview = await previewPublication(userId, input, now);
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now + 600_000)).rejects.toMatchObject({ code: 'stale_preview' });
        preview = await previewPublication(userId, input, now);
        await CalendarEventSnapshot.update({ title: 'Changed calendar title' }, { where: { userId } });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'stale_preview' });
        preview = await previewPublication(userId, input, now);
        destination.validate.mockResolvedValueOnce({ guildName: 'Renamed server', channelName: 'reminders' });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'stale_preview' });
        await CalendarSource.update({ enabled: false }, { where: { id: sourceId } });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'not_ready' });
        await CalendarSource.update({ enabled: true, lastSyncedAt: null }, { where: { id: sourceId } });
        await expect(previewPublication(userId, input, now)).rejects.toMatchObject({ code: 'not_ready' });
        await CalendarSource.update({ lastSyncedAt: now }, { where: { id: sourceId } });
        const replacement = await previewPublication(userId, input, now);
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'stale_preview' });
        await CalendarConnection.update({ status: 'disconnected' }, { where: { userId } });
        await expect(confirmPublication(userId, replacement.draftId, 'reminders', false, now)).rejects.toMatchObject({ code: 'not_ready' });
    });
    it('rechecks permissions at confirmation and returns generic errors without private SQL', async () => {
        const body = await confirmBody();
        const { CalendarPublishDiscordError } = await import('./discord.js');
        destination.validate.mockRejectedValueOnce(new CalendarPublishDiscordError('forbidden'));
        expectForbidden(await request(app).post('/publish/confirm').send(body));
        vi.spyOn(CalendarPublicationDraft, 'create').mockRejectedValueOnce(Object.assign(new Error('private-title'), { sql: 'private-SQL-token' }));
        const failed = await request(app).post('/publish/preview').send(input);
        expectServiceUnavailable(failed); expect(failed.text).not.toContain('private-title'); expect(failed.text).not.toContain('private-SQL-token');
        expect(await CalendarPublication.count()).toBe(0);
    });
    it('rejects invalid settings and more than 100 future items rather than publishing a sample', async () => {
        for (const mutation of [{ lookaheadDays: 366 }, { eventLeadDays: 0 }, { channelId: '../../users/@me' }, { publicTitle: '' }, { enabled: true }]) {
            expectBadRequest(await request(app).post('/publish/preview').send({ ...input, ...mutation }));
        }
        await seedEvents(Array.from({ length: 101 }, (_, index) => ({ ...event, occurrenceKey: String(index), eventId: `event-${index}` })));
        expectConflict(await request(app).post('/publish/preview').send(input));
        expect(await CalendarPublication.count()).toBe(0);
    });
    it('stops only owner publications; re-enable preserves identity and cannot silently alter active settings', async () => {
        const created = await request(app).post('/publish/confirm').send(await confirmBody());
        const id = created.body.publication.id;
        const second = await confirmBody(); expectConflict(await request(app).post('/publish/confirm').send(second));
        actor = otherUser; expectNotFound(await request(app).delete(`/publish/${id}`));
        actor = userId; expectOk(await request(app).delete(`/publish/${id}`));
        const restored = await request(app).post('/publish/confirm').send(await confirmBody());
        expect(restored.body.publication.id).toBe(id); expect(restored.body.publication.enabled).toBe(true);
        expect((await request(app).get('/publish')).body.publications).toHaveLength(1);
    });
    it('stopping imports or disconnecting turns off publishing atomically, and resume alone does not re-enable it', async () => {
        const created = await request(app).post('/publish/confirm').send(await confirmBody());
        const id = created.body.publication.id;
        await configManager.userScheduleManager.deactivateSource(sourceId, userId);
        expect((await CalendarPublication.findByPk(id))?.enabled).toBe(false);
        await CalendarSource.update({ enabled: true }, { where: { id: sourceId } });
        expect((await CalendarPublication.findByPk(id))?.enabled).toBe(false);
        await request(app).post('/publish/confirm').send(await confirmBody());
        await disconnectCalendar(userId);
        expect((await CalendarPublication.findByPk(id))?.enabled).toBe(false);
        expect(await ScheduleOccurrence.count({ where: { userId } })).toBe(1);
    });
    it('invalidates already issued previews after stopping, disconnecting or resuming imports', async () => {
        const created = await request(app).post('/publish/confirm').send(await confirmBody());
        let stale = await confirmBody();
        await request(app).delete(`/publish/${created.body.publication.id}`);
        expectConflict(await request(app).post('/publish/confirm').send(stale));
        stale = await confirmBody();
        await configManager.userScheduleManager.deactivateSource(sourceId, userId);
        await CalendarSource.update({ enabled: true }, { where: { id: sourceId } }); await seedEvents();
        expectConflict(await request(app).post('/publish/confirm').send(stale));
        stale = await confirmBody(); await disconnectCalendar(userId);
        await CalendarConnection.update({ status: 'connected' }, { where: { userId } });
        await CalendarSource.update({ enabled: true }, { where: { id: sourceId } });
        await seedEvents();
        expectConflict(await request(app).post('/publish/confirm').send(stale));
    });
    it('samples expiration after delayed permission checks, not only at request entry', async () => {
        const preview = await previewPublication(userId, input, now);
        destination.validate.mockImplementationOnce(async () => {
            vi.spyOn(Date, 'now').mockReturnValue(now + 2000);
            return { guildName: 'My server', channelName: 'reminders' };
        });
        await expect(confirmPublication(userId, preview.draftId, 'reminders', false, now + 599_000)).rejects.toMatchObject({ code: 'stale_preview' });
        expect(await CalendarPublication.count()).toBe(0);
    });
    it('requires an authoritative new snapshot for calendars imported before the upgrade', async () => {
        await CalendarEventSnapshotState.destroy({ where: {} });
        expectConflict(await request(app).post('/publish/preview').send(input));
        expect(destination.validate).not.toHaveBeenCalled();
        await seedEvents(); expectOk(await request(app).post('/publish/preview').send(input));
    });
});
