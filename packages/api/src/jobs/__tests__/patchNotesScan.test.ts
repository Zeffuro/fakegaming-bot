import { afterEach, describe, it, expect, vi } from 'vitest';
import { TestJobQueue } from '@zeffuro/fakegaming-common/testing';
import { registerPatchNotesScanJobs } from '../patchNotesScan.js';

afterEach(() => vi.restoreAllMocks());

describe('patch note scan jitter', () => {
    it.each([0, 0.5, 0.9999])('targets the same twenty-minute slot for random value %s', async random => {
        vi.spyOn(Math, 'random').mockReturnValue(random);
        const start = new Date('2026-11-21T12:00:00Z');
        const queue = new TestJobQueue();
        await registerPatchNotesScanJobs(queue, start);
        const interval = 20 * 60;
        const nextSlot = start.getTime() / (interval * 1000) + 1;
        expect(queue.scheduled[1]?.options).toMatchObject({
            startAfterSeconds: interval + Math.floor(random * 5 * 60),
            idempotencyKey: `patchnotes-scan:slot:${nextSlot}`,
        });
    });
});

