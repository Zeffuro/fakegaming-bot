import '../vitest.setup.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';

// Mock Discord REST sender BEFORE importing SUT to ensure it applies
vi.mock('../utils/discord.js', () => {
    return {
        sendChannelMessage: vi.fn(async (_channelId: string, _content: string) => ({ id: 'msg123' }))
    };
});

import { runBirthdaysOnce } from '../jobs/birthdays.js';

const cm = getConfigManager();

function dateParts(y: number, m: number, d: number) {
    return { year: y, month: m, day: d };
}

describe('Birthdays Job', () => {
    beforeEach(async () => {
        await cm.birthdayManager.removeAll();
        await cm.notificationsManager.removeAll();
        vi.clearAllMocks();
    });

    it('sends birthday messages once per day with idempotency', async () => {
        // Today: 15 June (construct using LOCAL time to avoid timezone skew)
        const runDateLocal = new Date(2025, 5, 15, 9, 0, 0); // months are 0-based -> 5 = June
        await cm.birthdayManager.addPlain({ userId: 'u1', guildId: 'g1', channelId: 'c1', ...dateParts(2000, 6, 15) });

        // Run one processing pass directly
        await runBirthdaysOnce(runDateLocal);

        const { sendChannelMessage } = await import('../utils/discord.js');
        const getCalls = () => (sendChannelMessage as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
        expect(getCalls()).toBe(1);

        // Run again for the same date -> should be deduped
        await runBirthdaysOnce(runDateLocal);
        expect(getCalls()).toBe(1);
    });
});
