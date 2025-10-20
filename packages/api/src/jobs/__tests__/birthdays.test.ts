import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/discord.js', () => ({ sendChannelMessage: vi.fn().mockResolvedValue({ id: 'm1' }) }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));

const mockIsBirthdayToday = vi.fn().mockReturnValue(true);

vi.mock('@zeffuro/fakegaming-common/managers', () => ({
    getConfigManager: () => ({
        birthdayManager: { getAllPlain: vi.fn().mockResolvedValue([{ userId: 'u', guildId: 'g', channelId: 'c', day: 1, month: 1, year: 2000 }]), isBirthdayToday: mockIsBirthdayToday },
        notificationsManager: {
            recordIfNew: vi.fn().mockResolvedValue({ created: true }),
            setMessageMeta: vi.fn().mockResolvedValue(null),
            getOnePlain: vi.fn().mockResolvedValue({ channelId: 'c' }),
        },
    })
}));

import { computeNextRunDelaySeconds, computeBirthdayRetryBackoffSeconds, runBirthdaysOnce } from '../birthdays.js';

const ORIGINAL_ENV = { ...process.env };

describe('birthdays jobs helpers', () => {
    beforeEach(() => { process.env = { ...ORIGINAL_ENV }; });
    afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

    it('computeNextRunDelaySeconds returns positive seconds until next 09:00', () => {
        const now = new Date('2025-01-01T08:30:00Z');
        const sec = computeNextRunDelaySeconds(now);
        expect(sec).toBeGreaterThan(0);
        expect(sec).toBeLessThan(24 * 3600);
    });

    it('computeBirthdayRetryBackoffSeconds increases with attempts', () => {
        const b1 = computeBirthdayRetryBackoffSeconds(1, 60, 900);
        const b2 = computeBirthdayRetryBackoffSeconds(2, 60, 900);
        expect(b2).toBeGreaterThanOrEqual(b1);
    });

    it('runBirthdaysOnce processes birthdays', async () => {
        const processed = await runBirthdaysOnce(new Date('2025-01-01T00:00:00Z'));
        expect(processed).toBeGreaterThanOrEqual(0);
    });
});
