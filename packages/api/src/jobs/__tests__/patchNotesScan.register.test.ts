import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({ patchNotesManager: { getLatestPatch: vi.fn().mockResolvedValue(null), setLatestPatch: vi.fn().mockResolvedValue(null) } })
}));
vi.mock('@zeffuro/fakegaming-common/patchnotes', () => ({
    getDefaultPatchNoteFetchers: () => ([{ game: 'G', fetchLatestPatchNote: vi.fn().mockResolvedValue(null) }])
}));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({ scheduleSingleton: vi.fn().mockResolvedValue('id') }));

import { registerPatchNotesScanJobs } from '../patchNotesScan.js';

describe('registerPatchNotesScanJobs', () => {
     it('registers handler and schedules jobs', async () => {
         const q = new TestJobQueue();
         await registerPatchNotesScanJobs(q as any, new Date('2025-01-01T00:00:00Z'));
         const { done } = await runJobHandler(q, 'patchnotes:scan', {} as any);
         expect(typeof done).toBe('function');
     });
});
