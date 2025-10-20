import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        patchNotesManager: { getAllPlain: vi.fn().mockResolvedValue([{ game: 'Game', title: 'T', content: 'C', url: 'https://x', publishedAt: Date.now(), logoUrl: null, imageUrl: null, version: '1.0', accentColor: 42 }]) },
        patchSubscriptionManager: {
            getSubscriptionsForGame: vi.fn().mockResolvedValue([{ id: '1', game: 'Game', channelId: 'chan', guildId: 'g', lastAnnouncedAt: 0 }]),
            upsert: vi.fn().mockResolvedValue(null),
        },
    })
}));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
vi.mock('../../utils/discord.js', () => ({ sendChannelMessagePayload: vi.fn().mockResolvedValue({ id: 'msg' }) }));
vi.mock('@zeffuro/fakegaming-common/jobs', () => ({
    scheduleSingleton: vi.fn().mockResolvedValue('jobid'),
    formatMinuteKey: (d: Date) => `${d.getUTCFullYear()}${(d.getUTCMonth()+1).toString().padStart(2,'0')}${d.getUTCDate().toString().padStart(2,'0')}${d.getUTCHours().toString().padStart(2,'0')}${d.getUTCMinutes().toString().padStart(2,'0')}`,
}));

import { buildPatchNoteEmbedPayload, computeNextQuarterHourDelaySeconds, registerPatchNotesJobs } from '../patchNotes.js';

describe('jobs/patchNotes helpers', () => {
    it('buildPatchNoteEmbedPayload builds a short description and fields', () => {
        const payload = buildPatchNoteEmbedPayload({
            game: 'G', title: 'Title', content: 'a'.repeat(400), url: 'https://u', publishedAt: Date.now(), logoUrl: 'https://logo', imageUrl: 'https://img', version: 'v', accentColor: 0x123456
        });
        expect(payload.embeds).toBeDefined();
        const embed: any = (payload.embeds as any[])[0];
        expect(embed.description.length).toBe(350);
        expect(embed.thumbnail.url).toBe('https://logo');
        expect(embed.image.url).toBe('https://img');
        expect(embed.color).toBe(0x123456);
    });

    it('computeNextQuarterHourDelaySeconds covers hour roll', () => {
        const d = new Date('2025-01-01T10:59:30Z');
        const sec = computeNextQuarterHourDelaySeconds(d, 1);
        // Next quarter after 10:59:30 should be 11:00
        expect(sec).toBeGreaterThan(0);
        const target = new Date(d.getTime());
        target.setUTCMinutes(0, 0, 0); target.setUTCHours(11);
        expect(sec).toBe(Math.floor((target.getTime() - d.getTime()) / 1000));
    });
});

describe('jobs/patchNotes register handler', () => {
    beforeEach(() => vi.useFakeTimers());

    it('registers handler and processes announcements', async () => {
        const q = new TestJobQueue();
        const now = new Date('2025-01-01T00:00:00Z');
        await registerPatchNotesJobs(q as any, now);
        const { done } = await runJobHandler(q, 'patchnotes:run', {});
        expect(done).toHaveBeenCalled();
    });
});
