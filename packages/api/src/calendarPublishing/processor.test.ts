import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnection, CalendarSource, CalendarPublication, CalendarPublicationDraft, CalendarPublicationDelivery,
    PersonalSchedule, ScheduleOccurrence, CalendarEventSnapshot, CalendarEventSnapshotState } from '@zeffuro/fakegaming-common/models';
import { configManager } from '../vitest.setup.js';
const transport = vi.hoisted(() => ({ validate: vi.fn(), send: vi.fn(), edit: vi.fn(), createEvent: vi.fn(), editEvent: vi.fn() }));
vi.mock('./discord.js', () => ({ validatePublicationDestination: transport.validate, sendPublicationMessage: transport.send,
    editPublicationMessage: transport.edit, createPublicationEvent: transport.createEvent, editPublicationEvent: transport.editEvent,
    CalendarPublishDiscordError: class extends Error { constructor(public code: string) { super(code); } } }));
import { processCalendarPublications } from './processor.js';
import { DAY, hashPublication, stopPublication } from './configuration.js';
import { publicationMessage, publicationEvent } from './payload.js';

const userId = '123456789012345678';
const now = Date.UTC(2026, 9, 9, 8);
const sourceId = randomUUID();
const publicationId = randomUUID();
const originalEvent = { seriesKey: 'series', occurrenceKey: 'first', eventId: 'private-google-event-id', title: 'Synthetic medicine', timezone: 'Europe/Amsterdam',
    plannedAt: now + 25 * DAY, endAt: now + 25 * DAY + 3_600_000, allDay: false, cancelled: false };

async function seedEvents(events = [originalEvent]) {
    await configManager.userScheduleManager.syncSource(sourceId, userId, events, now - DAY, now + 366 * DAY, now, 1);
}
async function occurrence() { return (await ScheduleOccurrence.findOne({ where: { userId } }))!; }
async function publicSnapshot() { return (await CalendarEventSnapshot.findOne({ where: { userId } }))!; }
async function publication() { return (await CalendarPublication.findByPk(publicationId))!; }

describe('persistent calendar channel and Discord Event publishing', () => {
    beforeEach(async () => {
        vi.restoreAllMocks(); vi.clearAllMocks(); vi.spyOn(Date, 'now').mockReturnValue(now);
        await CalendarPublicationDelivery.destroy({ where: {} }); await CalendarPublicationDraft.destroy({ where: {} });
        await CalendarEventSnapshot.destroy({ where: {} }); await CalendarEventSnapshotState.destroy({ where: {} });
        await CalendarPublication.destroy({ where: {} }); await ScheduleOccurrence.destroy({ where: {} });
        await PersonalSchedule.destroy({ where: {} }); await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
        await CalendarConnection.create({ userId, status: 'connected', version: 1 });
        await CalendarSource.create({ id: sourceId, userId, calendarId: 'private@example.test', label: 'private', timezone: 'Europe/Amsterdam', enabled: true, version: 1 });
        await seedEvents();
        await CalendarPublication.create({ id: publicationId, sourceId, userId, guildId: '223456789012345678', channelId: '323456789012345678',
            guildName: 'My server', channelName: 'reminders', lookaheadDays: 180, eventLeadDays: null, publicTitle: null, enabled: true, version: 1 });
        transport.validate.mockResolvedValue({ guildName: 'My server', channelName: 'reminders' });
        transport.send.mockResolvedValue({ status: 'sent', id: 'message-id' });
        transport.edit.mockImplementation(async (_channel, id) => ({ status: 'sent', id }));
        transport.createEvent.mockResolvedValue({ status: 'sent', id: 'event-id' });
        transport.editEvent.mockImplementation(async (_guild, id) => ({ status: 'sent', id }));
    });
    it('posts months ahead once, with titles/dates only, and never creates Events by default', async () => {
        await (await occurrence()).update({ note: 'private-note', completedAt: now, state: 'completed' });
        expect(await processCalendarPublications(now)).toEqual({ sent: 1, errors: 0 });
        const payload = transport.send.mock.calls[0][1];
        expect(payload.embeds[0].title).toBe(originalEvent.title); expect(payload.allowed_mentions).toEqual({ parse: [] });
        const content = JSON.stringify(payload);
        for (const privateValue of ['private-note', 'private@example', 'private-google-event-id', userId, 'completedAt', 'Taken']) expect(content).not.toContain(privateValue);
        await processCalendarPublications(now + 60_000);
        expect(transport.send).toHaveBeenCalledTimes(1); expect(transport.edit).not.toHaveBeenCalled(); expect(transport.createEvent).not.toHaveBeenCalled();
    });
    it('only creates Events inside the approved lead window and deduplicates after restart', async () => {
        await (await publication()).update({ eventLeadDays: 7 });
        await processCalendarPublications(now); expect(transport.createEvent).not.toHaveBeenCalled();
        await processCalendarPublications(now + 18 * DAY);
        expect(transport.createEvent).toHaveBeenCalledTimes(1);
        expect(transport.createEvent.mock.calls[0][1]).toMatchObject({ name: originalEvent.title, entity_type: 3, privacy_level: 2, channel_id: null });
        await processCalendarPublications(now + 18 * DAY + 60_000); expect(transport.createEvent).toHaveBeenCalledTimes(1);
        expect(await CalendarPublicationDelivery.count()).toBe(2);
    });
    it('updates stored messages and scheduled Events when provider dates change without creating duplicates', async () => {
        await (await publication()).update({ eventLeadDays: 30 });
        await processCalendarPublications(now);
        const row = await publicSnapshot(); await row.update({ title: 'Changed title', plannedAt: originalEvent.plannedAt + DAY, endAt: originalEvent.endAt + DAY });
        await processCalendarPublications(now + 60_000);
        expect(transport.send).toHaveBeenCalledTimes(1); expect(transport.createEvent).toHaveBeenCalledTimes(1);
        expect(transport.edit).toHaveBeenCalledWith('323456789012345678', 'message-id', expect.objectContaining({ embeds: [expect.objectContaining({ title: 'Changed title' })] }));
        expect(transport.editEvent).toHaveBeenCalledWith('223456789012345678', 'event-id', expect.objectContaining({ name: 'Changed title' }));
    });
    it('marks cancellations and past posts, preserving messages and private history', async () => {
        await (await publication()).update({ eventLeadDays: 30 });
        await processCalendarPublications(now);
        await (await publicSnapshot()).update({ cancelled: true });
        await processCalendarPublications(now + 60_000);
        expect(transport.edit.mock.calls[0][2].embeds[0].description).toBe('Calendar event cancelled');
        expect(transport.editEvent).toHaveBeenCalledWith('223456789012345678', 'event-id', { status: 4 });
        await (await publicSnapshot()).update({ cancelled: false });
        await processCalendarPublications(originalEvent.plannedAt + DAY);
        expect(transport.edit.mock.calls.at(-1)![2].embeds[0].description).toBe('Scheduled time has passed');
        expect(await ScheduleOccurrence.count()).toBe(1); expect(await CalendarPublicationDelivery.count()).toBe(2);
        expect(transport.send).toHaveBeenCalledTimes(1);
    });
    it('does not retry unknown creations, but retries definite rejection after backoff', async () => {
        transport.send.mockResolvedValueOnce({ status: 'uncertain' });
        await processCalendarPublications(now); await processCalendarPublications(now + DAY);
        expect(transport.send).toHaveBeenCalledTimes(1);
        expect((await CalendarPublicationDelivery.findOne())?.status).toBe('uncertain');
        await CalendarPublicationDelivery.destroy({ where: {} }); transport.send.mockClear();
        transport.send.mockResolvedValueOnce({ status: 'rejected' }).mockResolvedValue({ status: 'sent', id: 'message-id' });
        await processCalendarPublications(now); await processCalendarPublications(now + 60_000);
        expect(transport.send).toHaveBeenCalledTimes(1);
        expect((await publication()).lastError).toBe('rejected');
        await processCalendarPublications(now + 600_001); expect(transport.send).toHaveBeenCalledTimes(2);
        expect((await publication()).lastError).toBeNull();
    });
    it('recovers a crashed send as uncertain without replay and leaves existing remote IDs intact', async () => {
        const row = await occurrence();
        await CalendarPublicationDelivery.create({ id: hashPublication([publicationId, row.id, 'message']), publicationId, occurrenceId: row.id,
            kind: 'message', status: 'sending', attemptedAt: now - 600_001 });
        await processCalendarPublications(now);
        expect(transport.send).not.toHaveBeenCalled(); expect((await CalendarPublicationDelivery.findOne())?.status).toBe('uncertain');
    });
    it('cannot repeat a successfully sent creation when database settlement fails', async () => {
        const update = CalendarPublicationDelivery.update.bind(CalendarPublicationDelivery);
        let fail = true;
        vi.spyOn(CalendarPublicationDelivery, 'update').mockImplementation(async (...args) => {
            if (args[0].status === 'sent' && fail) { fail = false; throw new Error('DB failure after public send'); }
            return update(...args);
        });
        await processCalendarPublications(now); await processCalendarPublications(now + 600_001);
        expect(transport.send).toHaveBeenCalledTimes(1); expect((await CalendarPublicationDelivery.findOne())?.status).toBe('uncertain');
    });
    it('pauses when permissions disappear and stops claimed work when the owner disables publishing', async () => {
        const { CalendarPublishDiscordError } = await import('./discord.js');
        transport.validate.mockRejectedValueOnce(new CalendarPublishDiscordError('forbidden'));
        await processCalendarPublications(now); expect(transport.send).not.toHaveBeenCalled(); expect((await publication()).enabled).toBe(false);
        await (await publication()).update({ enabled: true, version: 2 });
        transport.validate.mockImplementation(async () => {
            if (await CalendarPublicationDelivery.count({ where: { status: 'sending' } })) await stopPublication(userId, publicationId);
            return { guildName: 'My server', channelName: 'reminders' };
        });
        await processCalendarPublications(now + 60_000); expect(transport.send).not.toHaveBeenCalled(); expect((await publication()).enabled).toBe(false);
    });
    it('fails closed on disconnected calendars, skips inactive destinations and rejects oversized future windows', async () => {
        await CalendarConnection.update({ status: 'disconnected' }, { where: { userId } });
        await processCalendarPublications(now); expect(transport.send).not.toHaveBeenCalled(); expect((await publication()).enabled).toBe(false);
        await processCalendarPublications(now + 60_000); expect(transport.validate).not.toHaveBeenCalled();
        await CalendarConnection.update({ status: 'connected' }, { where: { userId } }); await (await publication()).update({ enabled: true, version: 2 });
        await seedEvents(Array.from({ length: 101 }, (_, index) => ({ ...originalEvent, occurrenceKey: String(index), eventId: `id-${index}` })));
        await processCalendarPublications(now + 60_000); expect(transport.send).not.toHaveBeenCalled(); expect((await publication()).lastError).toBe('too_many');
    });
    it('does not recreate deleted posts or Events and keeps unknown Event outcomes independent of messages', async () => {
        await (await publication()).update({ eventLeadDays: 30 });
        transport.createEvent.mockResolvedValueOnce({ status: 'uncertain' });
        await processCalendarPublications(now); await processCalendarPublications(now + DAY);
        expect(transport.createEvent).toHaveBeenCalledTimes(1); expect(transport.send).toHaveBeenCalledTimes(1);
        transport.edit.mockResolvedValueOnce({ status: 'missing' }); await (await publicSnapshot()).update({ title: 'Changed title' });
        await processCalendarPublications(now + DAY); await processCalendarPublications(now + 2 * DAY);
        expect(transport.send).toHaveBeenCalledTimes(1); expect(transport.edit).toHaveBeenCalledTimes(1);
        expect((await publication()).lastError).toBe('rejected');
    });
    it('retries unknown updates with the same remote ID and does not bypass transient permission lookup failures', async () => {
        await processCalendarPublications(now);
        await (await publicSnapshot()).update({ title: 'Changed title' });
        transport.edit.mockResolvedValueOnce({ status: 'uncertain' });
        await processCalendarPublications(now + 60_000); await processCalendarPublications(now + 660_001);
        expect(transport.edit).toHaveBeenCalledTimes(2); expect(transport.send).toHaveBeenCalledTimes(1);
        const { CalendarPublishDiscordError } = await import('./discord.js');
        transport.validate.mockRejectedValueOnce(new CalendarPublishDiscordError('unavailable'));
        await processCalendarPublications(now + DAY); expect((await publication()).lastError).toBe('unavailable'); expect((await publication()).enabled).toBe(true);
    });
    it('reapplies the last acknowledged content after an uncertain edit when the desired title reverts', async () => {
        await processCalendarPublications(now);
        await (await publicSnapshot()).update({ title: 'Different public title' });
        transport.edit.mockResolvedValueOnce({ status: 'uncertain' });
        await processCalendarPublications(now + 60_000);
        await (await publicSnapshot()).update({ title: originalEvent.title });
        await processCalendarPublications(now + 660_001);
        expect(transport.edit).toHaveBeenCalledTimes(2);
        expect(transport.edit.mock.calls.at(-1)![2].embeds[0].title).toBe(originalEvent.title);
    });
    it('uses current provider snapshots after an early completion, including missing-event cancellation', async () => {
        const original = await occurrence();
        await original.update({ state: 'completed', completedAt: now, note: 'Private history', version: 1 });
        await seedEvents([{ ...originalEvent, title: 'Provider title', plannedAt: originalEvent.plannedAt + DAY, endAt: originalEvent.endAt + DAY }]);
        expect((await occurrence()).title).toBe(originalEvent.title);
        expect((await publicSnapshot()).title).toBe('Provider title');
        await processCalendarPublications(now);
        expect(transport.send.mock.calls[0][1].embeds[0].title).toBe('Provider title');
        await seedEvents([]); await processCalendarPublications(now + 60_000);
        expect(transport.edit.mock.calls[0][2].embeds[0].description).toBe('Calendar event cancelled');
        expect((await occurrence()).note).toBe('Private history'); expect((await occurrence()).plannedAt).toBe(original.plannedAt);
    });
    it('does not send a stale creation when the provider cancels during the permission gate', async () => {
        transport.validate.mockImplementation(async () => {
            if (await CalendarPublicationDelivery.count({ where: { status: 'sending' } })) await seedEvents([]);
            return { guildName: 'My server', channelName: 'reminders' };
        });
        await processCalendarPublications(now); expect(transport.send).not.toHaveBeenCalled();
        expect((await publicSnapshot()).cancelled).toBe(true);
    });
    it.each([1, 2])('samples eligibility after snapshot lock %s when the planned time passes while waiting', async lockToDelay => {
        await (await publicSnapshot()).update({ plannedAt: now + 60_000, endAt: now + 3_660_000 });
        let currentTime = now;
        vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
        const findOne = CalendarEventSnapshot.findOne.bind(CalendarEventSnapshot);
        let lockedReads = 0;
        vi.spyOn(CalendarEventSnapshot, 'findOne').mockImplementation(async options => {
            const result = await findOne(options);
            if (options?.lock && ++lockedReads === lockToDelay) currentTime = now + 60_001;
            return result;
        });
        await processCalendarPublications(now);
        expect(lockedReads).toBeGreaterThanOrEqual(lockToDelay);
        expect(transport.send).not.toHaveBeenCalled();
        expect(transport.createEvent).not.toHaveBeenCalled();
    });
    it.each(['en', 'nl'] as const)('uses localized public copy and a safe fallback end time in %s', locale => {
        const row = { id: 'id', title: '@everyone [title](https://private.test)', plannedAt: now + DAY, endAt: null, allDay: true, timezone: 'UTC', cancelled: false };
        const message = publicationMessage(row, locale, now);
        expect(message.allowed_mentions).toEqual({ parse: [] }); expect(JSON.stringify(message)).not.toContain('completed');
        expect((message.embeds as Array<{ fields: unknown[] }>)[0].fields).toHaveLength(2);
        expect(publicationEvent(row, locale)).toMatchObject({ scheduled_end_time: new Date(row.plannedAt + 3_600_000).toISOString() });
    });
});
