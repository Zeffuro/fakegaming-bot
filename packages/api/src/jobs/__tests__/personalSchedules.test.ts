import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import { PersonalSchedule, ScheduleOccurrence, ScheduleNotification, SchedulePreferences, CalendarSource, CalendarConnection } from '@zeffuro/fakegaming-common/models';
import { UserScheduleManager, ScheduleNotificationManager } from '@zeffuro/fakegaming-common/managers';
import { configManager } from '../../vitest.setup.js';
const mocks = vi.hoisted(() => ({ send: vi.fn(), edit: vi.fn(), status: vi.fn(), locale: vi.fn() }));
vi.mock('../scheduleDiscord.js', () => ({ sendScheduleMessage: mocks.send, editScheduleMessage: mocks.edit }));
vi.mock('../status.js', () => ({ recordJobRun: mocks.status }));
vi.mock('../../localization/locale.js', async importOriginal => ({ ...await importOriginal<object>(), resolveUserOutputLocale: mocks.locale }));
import { processPersonalSchedules, registerPersonalScheduleJobs, schedulePayload } from '../personalSchedules.js';

const manager = new UserScheduleManager();
beforeEach(async () => {
    await ScheduleNotification.destroy({ where: {} }); await ScheduleOccurrence.destroy({ where: {} });
    await PersonalSchedule.destroy({ where: {} }); await SchedulePreferences.destroy({ where: {} });
    await CalendarSource.destroy({ where: {} }); await CalendarConnection.destroy({ where: {} });
    mocks.send.mockReset().mockResolvedValue({ status: 'sent', messageId: '123', channelId: '456' });
    mocks.edit.mockReset().mockResolvedValue('edited');
    mocks.locale.mockReset().mockResolvedValue('nl'); mocks.status.mockReset();
});
afterEach(() => vi.restoreAllMocks());
async function due() {
    const item = await manager.createManual({ userId: 'schedule-owner', title: 'Reminder @everyone', plannedAt: Date.now() + 60_000, timezone: 'UTC' });
    await ScheduleOccurrence.update({ nextNotifyAt: Date.now() - 1000 }, { where: { id: item.id } });
    return (await manager.get(item.id, item.userId))!;
}

describe('private schedule jobs', () => {
    it('delivers once with saved user locale, durable private controls, and persists unconfirmed state after event time', async () => {
        const item = await due();
        const result = await processPersonalSchedules();
        expect(result).toEqual({ sent: 1, edited: 0, errors: 0 });
        const payload = mocks.send.mock.calls[0]?.[1] as { content: string; allowed_mentions: unknown; components: Array<{ components: Array<{ custom_id: string }> }> };
        expect(payload.content).toContain('Wacht op jouw bevestiging');
        expect(payload.allowed_mentions).toEqual({ parse: [] });
        expect(payload.components[0]?.components.map(button => button.custom_id)).toEqual([`schedule:d:${item.id}:0`, `schedule:t:${item.id}:0`, `schedule:s:${item.id}:0`]);
        await processPersonalSchedules(Date.now() + 86_400_000);
        expect(mocks.send).toHaveBeenCalledOnce();
        expect((await manager.get(item.id, item.userId))?.state).toBe('pending');
        expect((await ScheduleNotification.findOne())).toMatchObject({ status: 'sent', messageId: '123', channelId: '456' });
    });

    it('refreshes an in-flight completion, keeps its history after message deletion and never sends another reminder', async () => {
        const item = await due();
        mocks.send.mockImplementationOnce(async () => { await manager.complete(item.id, item.userId, 0, Date.now(), 'Recorded'); return { status: 'sent', messageId: '123', channelId: '456' }; });
        expect(await processPersonalSchedules()).toEqual({ sent: 1, edited: 1, errors: 0 });
        expect(mocks.edit.mock.calls[0]?.[2]?.content).toContain('Recorded');
        const done = (await manager.get(item.id, item.userId))!;
        await manager.note(item.id, item.userId, done.version, 'Changed note');
        mocks.edit.mockResolvedValueOnce('missing');
        await processPersonalSchedules();
        expect((await ScheduleNotification.findOne())?.messageId).toBeNull();
        expect((await manager.get(item.id, item.userId))?.completedAt).not.toBeNull();
        expect(await ScheduleOccurrence.count()).toBe(1);
        expect(mocks.send).toHaveBeenCalledOnce();
    });

    it('handles rejected and uncertain delivery separately and retires interrupted claims without POST replay', async () => {
        const item = await due();
        const timestamp = Date.now();
        mocks.send.mockResolvedValueOnce({ status: 'rejected' });
        expect((await processPersonalSchedules(timestamp)).errors).toBe(1);
        await processPersonalSchedules(timestamp + 60_000);
        expect(mocks.send).toHaveBeenCalledOnce();
        mocks.send.mockResolvedValueOnce({ status: 'uncertain' });
        const retryAt = (await manager.get(item.id, item.userId))!.nextNotifyAt!;
        await processPersonalSchedules(retryAt);
        await processPersonalSchedules(timestamp + 10 * 60_000);
        expect(mocks.send).toHaveBeenCalledTimes(2);
        expect((await ScheduleNotification.findOne())?.status).toBe('uncertain');
        const next = await manager.snooze(item.id, item.userId, 0, Date.now() + 60_000);
        expect(await new ScheduleNotificationManager().claim(next, next.nextNotifyAt!)).not.toBeNull();
        await processPersonalSchedules(next.nextNotifyAt! + 6 * 60_000);
        expect(mocks.send).toHaveBeenCalledTimes(2);
    });

    it('rechecks quiet hours using the current clock after delivery preparation is delayed', async () => {
        const item = await due();
        const nextDay = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        const startedAt = Date.parse(`${nextDay}T08:59:00Z`);
        const clock = vi.spyOn(Date, 'now').mockReturnValue(startedAt);
        await SchedulePreferences.create({ userId: item.userId, timezone: 'UTC', quietStart: '09:00', quietEnd: '10:00',
            followupMinutes: 0, maxFollowups: 0 });
        mocks.locale.mockImplementationOnce(async () => {
            clock.mockReturnValue(startedAt + 120_000);
            return 'nl';
        });
        expect(await processPersonalSchedules(startedAt)).toEqual({ sent: 0, edited: 0, errors: 0 });
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await ScheduleNotification.count()).toBe(0);
        expect((await manager.get(item.id, item.userId))?.nextNotifyAt).toBe(item.nextNotifyAt);
    });

    it('keeps known edits pending after transient failures and contains per-user locale failures', async () => {
        const item = await due();
        mocks.locale.mockRejectedValueOnce(new Error('locale unavailable'));
        expect((await processPersonalSchedules()).errors).toBe(1);
        expect(mocks.send).not.toHaveBeenCalled();
        await processPersonalSchedules();
        await manager.note(item.id, item.userId, 0, 'New note');
        mocks.edit.mockResolvedValueOnce('retry');
        expect((await processPersonalSchedules()).errors).toBe(1);
        mocks.edit.mockRejectedValueOnce(new Error('network'));
        expect((await processPersonalSchedules()).errors).toBe(1);
        expect((await processPersonalSchedules()).edited).toBe(1);
    });

    it('renders completed cancelled and all-day occurrences with correction/history controls in both locales', async () => {
        const item = await due();
        for (const locale of ['en', 'nl'] as const) {
            const payload = schedulePayload({ ...item, allDay: true, cancelled: true, state: 'completed', completedAt: Date.now(), note: 'Note' }, locale);
            expect(payload.content).toContain('Note');
            const rows = payload.components as Array<{ components: Array<{ custom_id: string }> }>;
            expect(rows[0]?.components.map(button => button.custom_id)).toEqual([`schedule:u:${item.id}:0`, `schedule:t:${item.id}:0`]);
            expect(JSON.stringify(schedulePayload({ ...item, cancelled: true }, locale))).not.toContain(`schedule:d:${item.id}`);
        }
    });

    it('prevents overlapping job runs and reschedules after database failure with only generic status data', async () => {
        let release!: () => void;
        vi.spyOn(configManager.userScheduleManager, 'ensureManual').mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
        const first = processPersonalSchedules();
        expect(await processPersonalSchedules()).toEqual({ sent: 0, edited: 0, errors: 0 });
        release(); await first;
        vi.spyOn(configManager.userScheduleManager, 'ensureManual').mockRejectedValueOnce(new Error('private record'));
        const queue = new TestJobQueue();
        const scheduled = vi.spyOn(queue, 'schedule');
        await registerPersonalScheduleJobs(queue);
        await runJobHandler(queue, 'personal-schedules:run', {});
        expect(mocks.status).toHaveBeenCalledWith('personal-schedules', expect.objectContaining({ ok: false, error: 'Private schedule processing failed' }));
        expect(JSON.stringify(mocks.status.mock.calls)).not.toContain('private record');
        expect(scheduled).toHaveBeenCalled();
        await runJobHandler(queue, 'personal-schedules:run', {});
        expect(mocks.status).toHaveBeenLastCalledWith('personal-schedules', expect.objectContaining({ ok: true }));
    });
});
