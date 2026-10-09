import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { UserFollowManager, followInQuietHours, followLocalTime } from '../userFollowManager.js';
import { UserFollow, UserFollowEvent, UserFollowSettings } from '../../models/personal-notifications.js';

describe('private follows', () => {
    const manager = new UserFollowManager();
    const now = Date.parse('2026-10-07T08:00:00Z');
    beforeEach(async () => {
        await UserFollowEvent.destroy({ where: {} });
        await UserFollowSettings.destroy({ where: {} });
        await UserFollow.destroy({ where: {} });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(now);
    });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    async function follow(mode: 'immediate' | 'digest' = 'immediate') {
        const value = await manager.add('owner', 'twitch', '@Example', 'Example', mode);
        await manager.observe(value.id, [{ eventKey: 'stream-1', title: 'Live @everyone', url: 'https://twitch.tv/example', occurredAt: now }], 'stream-1');
        return value;
    }

    it('normalizes and updates one follow while preserving owner isolation after manager recreation', async () => {
        const original = await follow();
        const updated = await manager.add('owner', 'twitch', 'example', 'Renamed', 'digest');
        expect(updated.id).toBe(original.id);
        expect(await UserFollow.count()).toBe(1);
        expect((await manager.pending())[0]?.mode).toBe('digest');
        expect(await new UserFollowManager().list('other')).toEqual([]);
        expect(await manager.change('other', original.id, 'remove')).toBe(false);
        expect(await manager.change('owner', original.id, 'pause')).toBe(true);
        expect(await manager.pending()).toEqual([]);
        expect(await manager.claim('owner', [(await UserFollowEvent.findOne())!.id])).toEqual([]);
        await manager.change('owner', original.id, 'resume');
        expect(await manager.pending()).toHaveLength(1);
        await manager.change('owner', original.id, 'remove');
        expect(await UserFollowEvent.count()).toBe(0);
    });

    it('deduplicates events, skips historical news and rejects unsafe or oversized provider links', async () => {
        const value = await follow();
        await manager.observe(value.id, [
            { eventKey: 'stream-1', title: 'Duplicate', url: 'https://twitch.tv/example', occurredAt: now },
            { eventKey: 'old', title: 'Before follow', url: 'https://twitch.tv/example', occurredAt: now - 86_400_000 },
            { eventKey: 'unsafe', title: 'Unsafe', url: 'javascript:alert(1)', occurredAt: now },
            { eventKey: 'long', title: 'Long', url: `https://example.com/${'x'.repeat(1000)}`, occurredAt: now },
            { eventKey: 'future', title: 'Future', url: 'https://example.com', occurredAt: now + 2 * 86_400_000 },
        ], 'stream-1');
        expect(await UserFollowEvent.count()).toBe(1);
    });

    it('claims a daily digest once concurrently and permits retry only after definite rejection', async () => {
        await follow('digest');
        const settings = await manager.preferences('owner', 'Europe/Amsterdam');
        expect(settings.timezone).toBe('Europe/Amsterdam');
        const event = (await manager.pending())[0]!;
        const results = await Promise.all([
            manager.claim('owner', [event.id], '2026-10-07'),
            new UserFollowManager().claim('owner', [event.id], '2026-10-07'),
        ]);
        expect(results.flat()).toHaveLength(1);
        expect(await manager.pending()).toHaveLength(0);
        await manager.settle('owner', [event.id], 'pending', '2026-10-07');
        expect((await manager.claim('owner', [event.id], '2026-10-07'))).toHaveLength(1);
        await manager.settle('owner', [event.id], 'uncertain', '2026-10-07');
        expect(await manager.claim('owner', [event.id], '2026-10-07')).toEqual([]);
        expect((await UserFollowEvent.findByPk(event.id))?.status).toBe('uncertain');
    });

    it('retires interrupted claims without replay and bounds event retention', async () => {
        await follow();
        const event = (await manager.pending())[0]!;
        expect(await manager.claim('other', [event.id])).toEqual([]);
        await manager.claim('owner', [event.id]);
        await manager.prune(now + 6 * 60_000);
        expect((await UserFollowEvent.findByPk(event.id))?.status).toBe('uncertain');
        await manager.prune(now + 31 * 86_400_000);
        expect(await UserFollowEvent.count()).toBe(0);
    });

    it('uses the saved timezone across DST and supports overnight or full-day quiet hours', async () => {
        const prefs = { timezone: 'Europe/Amsterdam', quietStart: '22:00', quietEnd: '07:30', digestAt: '09:00', lastDigestDate: null };
        expect(followInQuietHours(prefs, Date.parse('2026-10-24T21:00Z'))).toBe(true);
        expect(followInQuietHours(prefs, Date.parse('2026-10-25T07:00Z'))).toBe(false);
        expect(followLocalTime('Europe/Amsterdam', Date.parse('2026-10-25T01:30Z'))).toEqual({ date: '2026-10-25', minutes: 150 });
        expect(followInQuietHours({ ...prefs, quietEnd: '22:00' }, now)).toBe(true);
        expect(followInQuietHours({ ...prefs, quietStart: null, quietEnd: null }, now)).toBe(false);
        await expect(manager.configure('owner', { ...prefs, quietEnd: null })).rejects.toThrow();
        await expect(manager.configure('owner', { ...prefs, timezone: 'Invalid' })).rejects.toThrow();
        await manager.configure('owner', prefs);
        expect((await new UserFollowManager().preferences('owner')).timezone).toBe('Europe/Amsterdam');
    });

    it('rejects invalid follows and enforces the per-user limit under concurrent adds', async () => {
        await expect(manager.add('owner', 'steam', 'abc', 'game', 'immediate')).rejects.toThrow();
        await Promise.all(Array.from({ length: 30 }, (_, index) => manager.add('owner', 'steam', String(index + 1), 'game', 'immediate')));
        await expect(manager.add('owner', 'steam', '100', 'game', 'immediate')).rejects.toThrow('follow-capacity');
    });
});
