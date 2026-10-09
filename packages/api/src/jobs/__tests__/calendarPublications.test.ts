import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';
const mocks = vi.hoisted(() => ({ process: vi.fn(), status: vi.fn() }));
vi.mock('../../calendarPublishing/processor.js', () => ({ processCalendarPublications: mocks.process }));
vi.mock('../status.js', () => ({ recordJobRun: mocks.status }));
import { registerCalendarPublicationJobs } from '../calendarPublications.js';

describe('calendar publication job registration', () => {
    beforeEach(() => {
        mocks.process.mockReset().mockResolvedValue({ sent: 2, errors: 0 });
        mocks.status.mockReset();
    });
    it('schedules startup and periodic runs with aggregate status only', async () => {
        const queue = new TestJobQueue();
        const scheduled = vi.spyOn(queue, 'schedule');
        await registerCalendarPublicationJobs(queue);
        expect(scheduled).toHaveBeenCalledTimes(1);
        await runJobHandler(queue, 'calendar-publications:run', {});
        expect(mocks.process).toHaveBeenCalledOnce();
        expect(mocks.status).toHaveBeenCalledWith('calendar-publications', expect.objectContaining({ ok: true, meta: { sent: 2, errors: 0 } }));
        expect(scheduled).toHaveBeenCalledTimes(2);
    });
    it('reschedules after failed writes and unexpected exceptions without exposing calendar data', async () => {
        const queue = new TestJobQueue();
        const scheduled = vi.spyOn(queue, 'schedule');
        await registerCalendarPublicationJobs(queue);
        mocks.process.mockResolvedValueOnce({ sent: 0, errors: 1 });
        await runJobHandler(queue, 'calendar-publications:run', {});
        expect(mocks.status).toHaveBeenLastCalledWith('calendar-publications', expect.objectContaining({ ok: false, meta: { sent: 0, errors: 1 } }));
        mocks.process.mockRejectedValueOnce(new Error('private calendar information'));
        await runJobHandler(queue, 'calendar-publications:run', {});
        expect(mocks.status).toHaveBeenLastCalledWith('calendar-publications', expect.objectContaining({ ok: false, error: 'Calendar publication processing failed' }));
        expect(JSON.stringify(mocks.status.mock.calls)).not.toContain('private calendar information');
        expect(scheduled).toHaveBeenCalledTimes(3);
    });
});
