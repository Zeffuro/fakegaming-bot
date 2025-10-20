import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({ twitchManager: { getAllStreams: vi.fn().mockResolvedValue([]) }, notificationsManager: { has: vi.fn(), recordIfNew: vi.fn() } }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({ scheduleSingleton: vi.fn().mockResolvedValue('id'), formatMinuteKey: (d: Date) => `${d.getTime()}` }));

import { registerTwitchJobs } from '../twitch.js';

describe('registerTwitchJobs', () => {
    it('registers handler and schedules runs', async () => {
        const q = new TestJobQueue();
        await registerTwitchJobs(q as any, new Date('2025-01-01T00:00:00Z'));
        const { done } = await runJobHandler(q, 'twitch:poll', {});
        expect(done).toHaveBeenCalled();
    });
});
