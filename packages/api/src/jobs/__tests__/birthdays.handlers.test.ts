import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
import * as jobs from '@zeffuro/fakegaming-common/jobs';
import * as discord from '../../utils/discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { registerBirthdaysJobs } from '../birthdays.js';

const todayIso = '2025-06-15T09:00:00.000Z';
const today = new Date(todayIso);
const dateKey = '2025-06-15';

let scheduleSpy: any;
let sendResultQueue: Array<any | null> = [];

const cm = getConfigManager();
let getAllPlainSpy: any;
let isBirthdayTodaySpy: any;
let recordIfNewSpy: any;
let setMessageMetaSpy: any;
let getOnePlainSpy: any;

describe('jobs/birthdays handlers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Spies on shared functions
        scheduleSpy = vi.spyOn(jobs, 'scheduleSingleton').mockResolvedValue('jobid' as any);
        sendResultQueue = [];
        vi.spyOn(discord, 'sendChannelMessage').mockImplementation(async () => {
            return sendResultQueue.length > 0 ? sendResultQueue.shift()! : { id: 'm1' };
        });
        // Spies on config manager methods
        getAllPlainSpy = vi.spyOn(cm.birthdayManager, 'getAllPlain');
        isBirthdayTodaySpy = vi.spyOn(cm.birthdayManager, 'isBirthdayToday');
        recordIfNewSpy = vi.spyOn(cm.notificationsManager, 'recordIfNew');
        setMessageMetaSpy = vi.spyOn(cm.notificationsManager, 'setMessageMeta');
        getOnePlainSpy = vi.spyOn(cm.notificationsManager, 'getOnePlain');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('schedules retry when send fails and also schedules next daily run', async () => {
        const q = new TestJobQueue();
        // One matching birthday today
        getAllPlainSpy.mockResolvedValueOnce([{ userId: 'u1', guildId: 'g1', channelId: 'c1', day: 15, month: 6, year: 2000 }] as any);
        isBirthdayTodaySpy.mockReturnValue(true as any);
        recordIfNewSpy.mockResolvedValue({ created: true } as any);
        // Force a failure from send
        sendResultQueue.push(null);

        await registerBirthdaysJobs(q as any, today);
        const { done } = await runJobHandler(q, 'birthdays:run', { date: todayIso });
        expect(done).toHaveBeenCalled();
        // Expect a retry to be scheduled and a next daily run
        const names = scheduleSpy.mock.calls.map((c: unknown[]) => c[1] as string);
        expect(names).toContain('birthdays:retry');
        expect(names).toContain('birthdays:run');
    });

    it('force=true bypasses idempotency and sets message meta on success', async () => {
        const q = new TestJobQueue();
        getAllPlainSpy.mockResolvedValueOnce([{ userId: 'u2', guildId: 'g1', channelId: 'c1', day: 15, month: 6, year: 1990 }] as any);
        isBirthdayTodaySpy.mockReturnValue(true as any);
        // On success, send returns { id }
        sendResultQueue.push({ id: 'ok-msg' });

        await registerBirthdaysJobs(q as any, today);
        const { done } = await runJobHandler(q, 'birthdays:run', { date: todayIso, force: true });
        expect(done).toHaveBeenCalled();
        // recordIfNew should not be called when force=true
        expect(recordIfNewSpy).not.toHaveBeenCalled();
        expect(setMessageMetaSpy).toHaveBeenCalled();
    });

    it('retry handler schedules next attempt when channel missing', async () => {
        const q = new TestJobQueue();
        await registerBirthdaysJobs(q as any, today);
        getOnePlainSpy.mockResolvedValueOnce(null as any);
        const { done } = await runJobHandler(q, 'birthdays:retry', { eventId: `g1:u3:${dateKey}`, attempt: 1 });
        expect(done).toHaveBeenCalled();
        const names = scheduleSpy.mock.calls.map((c: unknown[]) => c[1] as string);
        expect(names).toContain('birthdays:retry');
    });

    it('retry handler sets message meta and does not schedule when send succeeds', async () => {
        const q = new TestJobQueue();
        await registerBirthdaysJobs(q as any, today);
        getOnePlainSpy.mockResolvedValueOnce({ channelId: 'c1' } as any);
        sendResultQueue.push({ id: 'mid' });
        const { done } = await runJobHandler(q, 'birthdays:retry', { eventId: `g1:u4:${dateKey}`, attempt: 2 });
        expect(done).toHaveBeenCalled();
        expect(setMessageMetaSpy).toHaveBeenCalled();
        const names = scheduleSpy.mock.calls.map((c: unknown[]) => c[1] as string);
        expect(names).not.toContain('birthdays:retry');
    });
});
