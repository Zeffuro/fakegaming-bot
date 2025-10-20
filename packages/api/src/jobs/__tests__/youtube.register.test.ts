import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({ youtubeManager: { getAllChannels: vi.fn().mockResolvedValue([]) }, notificationsManager: { has: vi.fn(), recordIfNew: vi.fn() } }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({ scheduleSingleton: vi.fn().mockResolvedValue('id'), formatMinuteKey: (d: Date) => `${d.getTime()}` }));

import { registerYouTubeJobs } from '../youtube.js';

describe('registerYouTubeJobs', () => {
    it('registers handler and schedules runs', async () => {
        const q = new TestJobQueue();
        await registerYouTubeJobs(q as any, new Date('2025-01-01T00:00:00Z'));
        const { done } = await runJobHandler(q, 'youtube:poll', {});
        expect(done).toHaveBeenCalled();
    });
});
