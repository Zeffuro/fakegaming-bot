import { beforeEach, describe, expect, it } from 'vitest';
import { UserSession } from '../../models/personal-productivity.js';
import { ReminderConfig } from '../../models/reminder-config.js';
import { ReminderDelivery } from '../../models/reminder-interaction.js';
import { UserSessionManager } from '../userSessionManager.js';
import { ReminderInteractionManager } from '../reminderInteractionManager.js';

let now = 1_800_000_000_000;
const messages = { focus: 'Focus', break: 'Break', finished: 'Finished', takeBreak: 'Take break' };
const input = { userId: 'owner', title: 'Practice', kind: 'focus' as const, minutes: 10, messages };
beforeEach(async () => {
    now = 1_800_000_000_000;
    await ReminderDelivery.destroy({ where: {} });
    await ReminderConfig.destroy({ where: {} });
    await UserSession.destroy({ where: {} });
});

describe('private sessions', () => {
    it('counts running time once across reads/restarts, excludes pauses and reschedules remaining duration atomically', async () => {
        const manager = new UserSessionManager(() => now);
        const session = await manager.start(input);
        now += 120_000;
        const paused = await manager.transition(session.id, 'owner', session.version, 'pause');
        expect(paused).toMatchObject({ workMs: 120_000, remainingMs: 480_000, state: 'paused' });
        expect(await ReminderConfig.count()).toBe(0);
        now += 900_000;
        const restarted = new UserSessionManager(() => now);
        expect((await restarted.getActive('owner'))?.workMs).toBe(120_000);
        const resumed = await restarted.transition(session.id, 'owner', paused.version, 'resume');
        expect(Number((await ReminderConfig.findByPk(resumed.reminderId!))?.timestamp)).toBe(now + 480_000);
        now += 180_000;
        expect((await restarted.getActive('owner'))?.workMs).toBe(300_000);
        expect((await restarted.getActive('owner'))?.workMs).toBe(300_000);
        const stopped = await restarted.transition(session.id, 'owner', resumed.version, 'stop');
        expect(stopped).toMatchObject({ workMs: 300_000, state: 'stopped' });
        expect(await ReminderConfig.count()).toBe(0);
        expect(await restarted.stats('owner')).toMatchObject({ focusMs: 300_000, gamingMs: 0 });
    });

    it('runs Pomodoro focus/break phases durably and finishes at actual boundary after an outage', async () => {
        const manager = new UserSessionManager(() => now);
        const start = now;
        const session = await manager.start({ ...input, minutes: 1, breakMinutes: 1, cycles: 2, pomodoro: true });
        now += 60_000;
        expect(await manager.prepareNotification(session.reminderId!, 'owner')).toBe('Break');
        const breaking = await manager.getActive('owner');
        expect(breaking).toMatchObject({ phase: 'break', workMs: 60_000, breakElapsedMs: 0, cycleIndex: 1 });
        expect(Number((await ReminderConfig.findByPk(breaking!.reminderId!))?.timestamp)).toBe(now + 60_000);
        now += 60_000;
        expect(await new UserSessionManager(() => now).prepareNotification(breaking!.reminderId!, 'owner')).toBe('Focus');
        now += 300_000;
        const done = await manager.get(session.id, 'owner');
        expect(done).toMatchObject({ state: 'finished', workMs: 120_000, breakElapsedMs: 60_000, endedAt: start + 180_000, cycleIndex: 2 });
        expect(await manager.getActive('owner')).toBeNull();
        expect(await manager.stats('owner')).toMatchObject({ focusMs: 120_000, breakMs: 60_000 });
    });

    it('handles free gaming with periodic breaks and cancels pending deliveries on pause/stop', async () => {
        const manager = new UserSessionManager(() => now);
        const session = await manager.start({ ...input, kind: 'gaming', minutes: null, breakEveryMinutes: 2 });
        now += 120_000;
        expect(await manager.prepareNotification(session.reminderId!, 'owner')).toBe('Take break');
        const active = await manager.getActive('owner');
        const reminder = await ReminderConfig.findByPk(active!.reminderId!);
        const deliveries = new ReminderInteractionManager(() => now);
        const delivery = await deliveries.prepareDelivery({ id: reminder!.id, userId: 'owner', message: reminder!.message }, Number(reminder!.timestamp));
        const paused = await manager.transition(session.id, 'owner', active!.version, 'pause');
        expect(await deliveries.claimDelivery(delivery.id)).toBe(false);
        expect(await manager.prepareNotification(reminder!.id, 'owner')).toBeNull();
        const stopped = await manager.transition(session.id, 'owner', paused.version, 'stop');
        expect(stopped.workMs).toBe(120_000);
        expect(await manager.stats('owner')).toMatchObject({ gamingMs: 120_000 });
    });

    it('enforces owner, one active session, replay and concurrent pause transitions', async () => {
        const manager = new UserSessionManager(() => now);
        const session = await manager.start(input);
        await expect(manager.start(input)).rejects.toMatchObject({ code: 'exists' });
        expect(await manager.get(session.id, 'other')).toBeNull();
        expect(await manager.prepareNotification(session.reminderId!, 'other')).toBeNull();
        await expect(manager.transition(session.id, 'other', 0, 'stop')).rejects.toMatchObject({ code: 'missing' });
        const results = await Promise.allSettled([manager.transition(session.id, 'owner', 0, 'pause'), new UserSessionManager(() => now).transition(session.id, 'owner', 0, 'pause')]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        await expect(manager.transition(session.id, 'owner', 0, 'resume')).rejects.toMatchObject({ code: 'stale' });
    });

    it('does not double count when the wall clock moves backwards', async () => {
        const manager = new UserSessionManager(() => now);
        const session = await manager.start(input);
        now += 60_000;
        expect((await manager.get(session.id, 'owner'))?.workMs).toBe(60_000);
        now -= 30_000;
        expect((await manager.get(session.id, 'owner'))?.workMs).toBe(60_000);
        now += 60_000;
        expect((await manager.get(session.id, 'owner'))?.workMs).toBe(90_000);
    });
});
