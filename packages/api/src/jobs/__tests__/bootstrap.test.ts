import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

vi.mock('@zeffuro/fakegaming-common', () => ({
    getLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
    MemoryJobQueue: class {
        on() {}
        async start() {}
        async schedule() { return 'id'; }
    }
}));

vi.mock('../birthdays.js', () => ({ registerBirthdaysJobs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../reminders.js', () => ({ registerRemindersJobs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../patchNotes.js', () => ({ registerPatchNotesJobs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../patchNotesScan.js', () => ({ registerPatchNotesScanJobs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../twitch.js', () => ({ registerTwitchJobs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../youtube.js', () => ({ registerYouTubeJobs: vi.fn().mockResolvedValue(undefined) }));

import * as birthdays from '../birthdays.js';
import * as reminders from '../reminders.js';
import * as patchNotes from '../patchNotes.js';
import * as patchNotesScan from '../patchNotesScan.js';
import * as twitch from '../twitch.js';
import * as youtube from '../youtube.js';

async function importFresh<T = any>(modulePath: string): Promise<T> {
    vi.resetModules();
    return await import(modulePath) as T;
}

describe('jobs/bootstrap', () => {
    beforeEach(() => { process.env = { ...ORIGINAL_ENV }; vi.clearAllMocks(); });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

    it('returns early when JOBS_ENABLED!=1', async () => {
        delete process.env.JOBS_ENABLED;
        const { bootstrapJobs, getActiveJobQueue } = await importFresh('../bootstrap.js');
        await bootstrapJobs();
        expect(getActiveJobQueue()).toBeNull();
        expect(vi.mocked(birthdays).registerBirthdaysJobs).not.toHaveBeenCalled();
    });

    it('starts memory backend and registers all job modules', async () => {
        process.env.JOBS_ENABLED = '1';
        process.env.JOBS_BACKEND = 'memory';
        const { bootstrapJobs, getActiveJobQueue } = await importFresh('../bootstrap.js');
        await bootstrapJobs();
        expect(getActiveJobQueue()).not.toBeNull();
        expect(vi.mocked(birthdays).registerBirthdaysJobs).toHaveBeenCalled();
        expect(vi.mocked(reminders).registerRemindersJobs).toHaveBeenCalled();
        expect(vi.mocked(patchNotes).registerPatchNotesJobs).toHaveBeenCalled();
        expect(vi.mocked(patchNotesScan).registerPatchNotesScanJobs).toHaveBeenCalled();
        expect(vi.mocked(twitch).registerTwitchJobs).toHaveBeenCalled();
        expect(vi.mocked(youtube).registerYouTubeJobs).toHaveBeenCalled();
    });

    it('with pg-boss backend but wrong DB provider returns early', async () => {
        process.env.JOBS_ENABLED = '1';
        delete process.env.JOBS_BACKEND; // defaults to pg-boss path
        process.env.DATABASE_PROVIDER = 'sqlite';
        const { bootstrapJobs, getActiveJobQueue } = await importFresh('../bootstrap.js');
        await bootstrapJobs();
        expect(getActiveJobQueue()).toBeNull();
        expect(vi.mocked(birthdays).registerBirthdaysJobs).not.toHaveBeenCalled();
    });

    it('with pg-boss provider but missing DATABASE_URL returns early', async () => {
        process.env.JOBS_ENABLED = '1';
        delete process.env.JOBS_BACKEND;
        process.env.DATABASE_PROVIDER = 'postgres';
        delete process.env.DATABASE_URL;
        const { bootstrapJobs, getActiveJobQueue } = await importFresh('../bootstrap.js');
        await bootstrapJobs();
        expect(getActiveJobQueue()).toBeNull();
        expect(vi.mocked(birthdays).registerBirthdaysJobs).not.toHaveBeenCalled();
    });
});
