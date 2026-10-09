import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserScheduleManager } from '../userScheduleManager.js';
import { nextScheduleWeek } from '../scheduleShared.js';
import { PersonalSchedule, ScheduleNotification, ScheduleOccurrence, SchedulePreferences } from '../../models/personal-schedule.js';

const now = Date.parse('2026-10-07T08:00:00Z');
const manager = new UserScheduleManager(() => Date.now());
beforeEach(async () => {
    await ScheduleNotification.destroy({ where: {} });
    await ScheduleOccurrence.destroy({ where: {} });
    await PersonalSchedule.destroy({ where: {} });
    await SchedulePreferences.destroy({ where: {} });
    vi.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => vi.restoreAllMocks());
const create = (repeatWeeks: number | null = null, userId = 'owner') => manager.createManual({ userId, title: 'Injection',
    plannedAt: now + 60_000, timezone: 'Europe/Amsterdam', repeatWeeks });

describe('personal schedule history', () => {
    it('keeps an eight-week wall-clock cadence across DST independent of late completion or snooze', async () => {
        const first = await create(8);
        const original = (await manager.list('owner', 'all')).map(row => row.plannedAt);
        expect(original.length).toBeGreaterThan(6);
        expect(original[1]).toBe(Date.parse('2026-12-02T09:01:00Z'));
        const snoozed = await manager.snooze(first.id, 'owner', 0, now + 3_600_000);
        const late = await new UserScheduleManager(() => now + 86_400_000).complete(first.id, 'owner', snoozed.version);
        expect(late).toMatchObject({ plannedAt: first.plannedAt, completedAt: now + 86_400_000, nextNotifyAt: null });
        await manager.ensureManual(); await manager.ensureManual();
        expect((await manager.list('owner', 'all')).map(row => row.plannedAt)).toEqual(original);
        expect(await manager.get(first.id, 'other')).toBeNull();
        expect(await new UserScheduleManager().list('other', 'all')).toEqual([]);
    });

    it('persists correction, undo and notes with owner/version checks and one concurrent winner', async () => {
        const first = await create();
        const results = await Promise.allSettled([manager.complete(first.id, 'owner', 0), manager.complete(first.id, 'owner', 0)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        await expect(manager.complete(first.id, 'other', 1)).rejects.toMatchObject({ code: 'missing' });
        const corrected = await manager.complete(first.id, 'owner', 1, now - 3_600_000, 'Taken earlier');
        const note = await manager.note(first.id, 'owner', corrected.version, 'Revised note');
        const undone = await manager.undo(first.id, 'owner', note.version);
        expect(undone).toMatchObject({ state: 'pending', completedAt: null, note: 'Revised note', nextNotifyAt: now + 60_000, notificationCount: 0 });
        await expect(manager.undo(first.id, 'owner', undone.version)).rejects.toMatchObject({ code: 'stale' });
        expect((await ScheduleOccurrence.findByPk(first.id))?.notificationEpoch).toBe(1);
        expect(await new UserScheduleManager().get(first.id, 'owner')).toEqual(undone);
        expect(await manager.setEnabled(first.scheduleId, 'other', false)).toBe(false);
        expect(await manager.setEnabled(first.scheduleId, 'owner', false)).toBe(true);
    });

    it('retains unconfirmed history after the planned end and exports all owner records without credentials', async () => {
        const first = await manager.createManual({ userId: 'owner', title: '=FORMULA', plannedAt: now + 60_000, timezone: 'UTC', repeatWeeks: 8 });
        await create(null, 'other');
        await manager.note(first.id, 'owner', 0, '@note\n"quoted"');
        const later = new UserScheduleManager(() => now + 400 * 86_400_000);
        const unconfirmed = await later.list('owner', 'unconfirmed');
        expect(unconfirmed.length).toBeGreaterThan(6);
        const summary = await later.summary('owner', first.scheduleId);
        expect(summary).toMatchObject({ last: null, next: null, unconfirmed: unconfirmed.length });
        const completed = await later.complete(first.id, 'owner', 1);
        expect((await later.summary('owner', first.scheduleId)).last).toEqual(completed);
        expect(await later.list('owner', 'completed')).toEqual([completed]);
        const exported = JSON.parse(await later.export('owner', 'json')) as { occurrences: Array<{ userId: string }>; schedules: unknown[] };
        expect(exported.occurrences).toHaveLength(unconfirmed.length);
        expect(exported.occurrences.every(row => row.userId === 'owner')).toBe(true);
        expect(exported.schedules).toHaveLength(1);
        const csv = await later.export('owner', 'csv');
        expect(csv).toContain('"\'=FORMULA"');
        expect(csv).toContain('"\'@note\n""quoted"""');
        expect(csv).not.toContain('encrypted');
    });

    it('validates dates, repeat bounds, notes and paired quiet-hour/follow-up preferences', async () => {
        for (const change of [{ plannedAt: now }, { plannedAt: now + 4000 * 86_400_000 }, { repeatWeeks: 0 }, { repeatWeeks: 53 }, { timezone: 'Invalid' }, { title: '' }]) {
            await expect(manager.createManual({ userId: 'owner', title: 'Valid', plannedAt: now + 60_000, timezone: 'UTC', ...change })).rejects.toThrow();
        }
        const item = await create();
        await expect(manager.complete(item.id, 'owner', 0, now + 1)).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.complete(item.id, 'owner', 0, now, 'x'.repeat(1001))).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.note(item.id, 'owner', 0, 'x'.repeat(1001))).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.snooze(item.id, 'owner', 0, now)).rejects.toMatchObject({ code: 'invalid' });
        const defaults = await manager.preferences('owner', 'Europe/Amsterdam');
        expect(defaults).toEqual({ timezone: 'Europe/Amsterdam', quietStart: null, quietEnd: null, followupMinutes: 0, maxFollowups: 0 });
        for (const change of [{ quietStart: '22:00' }, { quietStart: '25:00', quietEnd: '07:00' }, { maxFollowups: 9 }, { maxFollowups: 1, followupMinutes: 5 }]) {
            await expect(manager.configure('owner', { ...defaults, ...change })).rejects.toMatchObject({ code: 'invalid' });
        }
        await manager.configure('owner', { ...defaults, quietStart: '22:00', quietEnd: '07:00', maxFollowups: 2, followupMinutes: 60 });
        expect((await manager.preferences('owner')).maxFollowups).toBe(2);
        await manager.configure('new', defaults);
        expect(await manager.preferences('new')).toEqual(defaults);
    });

    it('resolves recurring DST gaps and overlaps while restoring the original clock the following week', async () => {
        const springAnchor = Date.parse('2026-03-22T01:30Z');
        const gap = nextScheduleWeek(springAnchor, 1, 'Europe/Amsterdam', springAnchor);
        expect(gap).toBe(Date.parse('2026-03-29T01:30Z'));
        expect(nextScheduleWeek(gap, 1, 'Europe/Amsterdam', springAnchor)).toBe(Date.parse('2026-04-05T00:30Z'));
        const autumnAnchor = Date.parse('2026-10-18T00:30Z');
        const overlap = nextScheduleWeek(autumnAnchor, 1, 'Europe/Amsterdam', autumnAnchor);
        expect(overlap).toBe(Date.parse('2026-10-25T00:30Z'));
        expect(nextScheduleWeek(overlap, 1, 'Europe/Amsterdam', autumnAnchor)).toBe(Date.parse('2026-11-01T01:30Z'));
        const item = await manager.createManual({ userId: 'owner', title: 'Weekly', timezone: 'Europe/Amsterdam', plannedAt: autumnAnchor, repeatWeeks: 1 });
        expect((await manager.list('owner', 'all', item.scheduleId)).map(row => row.plannedAt)).toContain(Date.parse('2027-03-28T01:30Z'));
    });

    it('enforces capacity transactionally', async () => {
        const rows = Array.from({ length: 100 }, (_, index) => ({ id: String(index), userId: 'owner', title: 'Other', timezone: 'UTC',
            sourceId: null, externalKey: null, anchorAt: now + 60_000, repeatWeeks: null, enabled: true }));
        await PersonalSchedule.bulkCreate(rows);
        await expect(create()).rejects.toMatchObject({ code: 'capacity' });
        expect(await ScheduleOccurrence.count()).toBe(0);
    });
});
