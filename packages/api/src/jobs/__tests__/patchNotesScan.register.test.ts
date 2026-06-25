import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const hoisted = vi.hoisted(() => ({
    fetchLatestPatchNote: vi.fn(),
    getLatestPatch: vi.fn(),
    recordJobRun: vi.fn(),
    setLatestPatch: vi.fn(),
}));

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        patchNotesManager: {
            getLatestPatch: hoisted.getLatestPatch,
            setLatestPatch: hoisted.setLatestPatch,
        },
    }),
}));
vi.mock('@zeffuro/fakegaming-common/patchnotes', () => ({
    getDefaultPatchNoteFetchers: () => ([{ game: 'G', fetchLatestPatchNote: hoisted.fetchLatestPatchNote }])
}));
vi.mock('../status.js', () => ({ recordJobRun: hoisted.recordJobRun }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({ scheduleSingleton: vi.fn().mockResolvedValue('id') }));

import { registerPatchNotesScanJobs } from '../patchNotesScan.js';

describe('registerPatchNotesScanJobs', () => {
     beforeEach(() => {
         hoisted.fetchLatestPatchNote.mockReset();
         hoisted.getLatestPatch.mockReset();
         hoisted.recordJobRun.mockReset();
         hoisted.setLatestPatch.mockReset();
     });

     it('registers handler and schedules jobs', async () => {
         hoisted.getLatestPatch.mockResolvedValue(null);
         hoisted.fetchLatestPatchNote.mockResolvedValue(null);
         const q = new TestJobQueue();
         await registerPatchNotesScanJobs(q as any, new Date('2025-01-01T00:00:00Z'));
         const { done } = await runJobHandler(q, 'patchnotes:scan', {} as any);
         expect(typeof done).toBe('function');
     });

     it('records patch history retention metadata after a scan', async () => {
         hoisted.getLatestPatch.mockResolvedValue(null);
         hoisted.fetchLatestPatchNote.mockResolvedValue({
             content: 'content',
             publishedAt: 1000,
             title: 'Patch',
             url: 'https://example.com/patch',
             version: '1.0',
         });
         hoisted.setLatestPatch.mockResolvedValue({
             contentBytes: 7,
             contentTruncated: true,
             inserted: true,
             prunedRows: 2,
         });

         const q = new TestJobQueue();
         await registerPatchNotesScanJobs(q as any, new Date('2025-01-01T00:00:00Z'));
         await runJobHandler(q, 'patchnotes:scan', {} as any);

         expect(hoisted.recordJobRun).toHaveBeenCalledWith('patchnotes-scan', expect.objectContaining({
             meta: {
                 errors: 0,
                 historyPrunedRows: 2,
                 historyTruncated: 1,
                 total: 1,
                 updated: 1,
             },
             ok: true,
         }));
     });
});
