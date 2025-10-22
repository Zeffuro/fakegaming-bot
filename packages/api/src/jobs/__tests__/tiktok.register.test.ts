import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({ tiktokManager: { getAllStreams: vi.fn().mockResolvedValue([]) }, notificationsManager: { has: vi.fn(), recordIfNew: vi.fn() } }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({ scheduleSingleton: vi.fn().mockResolvedValue('id'), formatMinuteKey: (d: Date) => `${d.getTime()}` }));

import { scheduleSingleton } from '@zeffuro/fakegaming-common/jobs';
import { registerTikTokJobs } from '../tiktok.js';

describe('registerTikTokJobs', () => {
    it('registers handler and schedules runs', async () => {
        const q = new TestJobQueue();
        await registerTikTokJobs(q as any, new Date('2025-01-01T00:00:00Z'));
        const { done } = await runJobHandler(q, 'tiktok:poll', {});
        expect(done).toHaveBeenCalled();
        // ensure one of the schedule calls uses 15 minutes (900 seconds)
        const calls = (scheduleSingleton as unknown as { mock: { calls: any[][] } }).mock.calls;
        expect(calls.some(c => c?.[3] === 900)).toBe(true);
    });
});
