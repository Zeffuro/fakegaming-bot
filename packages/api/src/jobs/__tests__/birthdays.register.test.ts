import { describe, it, expect, vi } from 'vitest';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

vi.mock('../../utils/discord.js', () => ({ sendChannelMessage: vi.fn().mockResolvedValue({ id: 'm1' }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const mockIsBirthdayToday = vi.fn().mockReturnValue(true);

vi.mock('@zeffuro/fakegaming-common/managers', () => ({ getConfigManager: () => ({
    birthdayManager: { getAllPlain: vi.fn().mockResolvedValue([{ userId: 'u', guildId: 'g', channelId: 'c', day: 1, month: 1, year: 2000 }]), isBirthdayToday: mockIsBirthdayToday },
    notificationsManager: { recordIfNew: vi.fn().mockResolvedValue({ created: true }), setMessageMeta: vi.fn().mockResolvedValue(null) }
}) }));

import { registerBirthdaysJobs } from '../birthdays.js';

describe('registerBirthdaysJobs', () => {
    it('registers daily run and processes sending', async () => {
        const q = new TestJobQueue();
        await registerBirthdaysJobs(q as any, new Date('2025-01-01T08:00:00Z'));
        const { done } = await runJobHandler(q, 'birthdays:run', {});
        expect(done).toHaveBeenCalled();
    });
});
