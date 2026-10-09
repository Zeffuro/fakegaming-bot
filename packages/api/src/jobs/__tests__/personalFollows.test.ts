import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFollow, UserFollowEvent, UserFollowSettings } from '@zeffuro/fakegaming-common/models';
import { configManager } from '../../vitest.setup.js';
import { TestJobQueue, runJobHandler } from '@zeffuro/fakegaming-common/testing';

const mocks = vi.hoisted(() => ({ twitch: vi.fn(), steam: vi.fn(), send: vi.fn() }));
vi.mock('@zeffuro/fakegaming-common/notifications', () => ({ fetchPersonalTwitchStreams: mocks.twitch }));
vi.mock('../steamNews.js', () => ({ fetchSteamNewsForApp: mocks.steam }));
vi.mock('../../utils/discord.js', () => ({ sendDirectMessagePayloadResult: mocks.send }));
vi.mock('../status.js', () => ({ recordJobRun: vi.fn() }));
import { processPersonalFollows, registerPersonalFollowJobs } from '../personalFollows.js';

describe('private follow delivery', () => {
    const now = Date.parse('2026-10-07T10:00Z');
    const manager = configManager.userFollowManager;
    let steamTarget = 100;
    beforeEach(async () => {
        await UserFollowEvent.destroy({ where: {} });
        await UserFollowSettings.destroy({ where: {} });
        await UserFollow.destroy({ where: {} });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(now);
        mocks.twitch.mockResolvedValue([{ id: 'stream', user_login: 'example', user_name: 'Example', title: 'Playing @everyone', started_at: new Date(now).toISOString() }]);
        mocks.steam.mockResolvedValue([]);
        mocks.send.mockResolvedValue({ status: 'sent', message: { id: 'dm', channel_id: 'channel' } });
    });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    async function follow(provider: 'steam' | 'twitch' = 'twitch', mode: 'immediate' | 'digest' = 'immediate') {
        const record = await manager.add('owner', provider, provider === 'steam' ? String(++steamTarget) : 'example', 'Game', mode);
        return record;
    }

    it('sends only new updates privately, deduplicates restart polls, and batches provider lookups', async () => {
        await follow();
        await manager.add('other', 'twitch', 'example', 'Example', 'immediate');
        await processPersonalFollows(now);
        expect(mocks.twitch).toHaveBeenCalledOnce();
        expect(mocks.send).toHaveBeenCalledTimes(2);
        expect(mocks.send.mock.calls[0]![1]).toMatchObject({ allowed_mentions: { parse: [] } });
        expect(mocks.send.mock.calls[0]![1].content).toContain('@everyone');
        await processPersonalFollows(now + 120_000);
        expect(mocks.send).toHaveBeenCalledTimes(2);
        expect(await UserFollowEvent.count({ where: { status: 'sent' } })).toBe(2);
    });

    it('queues quiet-hour updates and sends every digest page once after the configured local time', async () => {
        const record = await follow('steam', 'digest');
        mocks.steam.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ gid: `news-${index}`, title: 'x'.repeat(140), url: `https://store.steampowered.com/news/app/${record.target}/view/${index}${'1'.repeat(130)}`, date: now / 1000 })));
        await manager.configure('owner', { timezone: 'Europe/Amsterdam', quietStart: '10:00', quietEnd: '12:30', digestAt: '12:00' });
        await processPersonalFollows(now);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(20);
        await processPersonalFollows(now + 60 * 60_000);
        expect(mocks.send.mock.calls.length).toBeGreaterThan(1);
        for (const call of mocks.send.mock.calls) expect(call[1].content.length).toBeLessThanOrEqual(2000);
        expect(await UserFollowEvent.count({ where: { status: 'sent' } })).toBe(20);
        const calls = mocks.send.mock.calls.length;
        await processPersonalFollows(now + 2 * 60 * 60_000);
        expect(mocks.send).toHaveBeenCalledTimes(calls);
    });

    it('retries definite rejection but never replays an ambiguous POST after restart', async () => {
        await follow();
        mocks.send.mockResolvedValueOnce({ status: 'rejected' });
        await processPersonalFollows(now);
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(1);
        mocks.send.mockResolvedValueOnce({ status: 'unknown' });
        await processPersonalFollows(now + 120_000);
        expect(await UserFollowEvent.count({ where: { status: 'uncertain' } })).toBe(1);
        await processPersonalFollows(now + 240_000);
        expect(mocks.send).toHaveBeenCalledTimes(2);
    });

    it('retries a rejected later digest page without resending successful pages', async () => {
        const record = await follow('steam', 'digest');
        mocks.steam.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ gid: `page-${index}`, title: 'x'.repeat(140), url: `https://example.com/${index}${'1'.repeat(130)}`, date: now / 1000 })));
        mocks.send.mockResolvedValueOnce({ status: 'sent', message: { id: 'first', channel_id: 'dm' } }).mockResolvedValueOnce({ status: 'rejected' });
        await processPersonalFollows(now);
        const delivered = await UserFollowEvent.count({ where: { status: 'sent' } });
        expect(delivered).toBeGreaterThan(0);
        expect(delivered).toBeLessThan(20);
        expect((await manager.preferences('owner')).lastDigestDate).toBeNull();
        const firstPage = mocks.send.mock.calls[0]![1].content;
        await processPersonalFollows(now + 120_000);
        expect(await UserFollowEvent.count({ where: { status: 'sent' } })).toBe(20);
        expect(mocks.send.mock.calls.filter(call => call[1].content === firstPage)).toHaveLength(1);
        expect(record.mode).toBe('digest');
    });

    it('does not resurrect retained-out Steam news when a new post changes the cursor', async () => {
        vi.setSystemTime(now - 40 * 86_400_000);
        const record = await follow('steam');
        vi.setSystemTime(now);
        await record.update({ cursor: 'old' });
        await UserFollowEvent.create({ id: 'retained-out', userId: 'owner', followId: record.id, eventKey: 'old', title: 'Old', url: 'https://example.com/old', mode: 'immediate', status: 'sent', occurredAt: now - 31 * 86_400_000, attemptedAt: null });
        mocks.steam.mockResolvedValue([
            { gid: 'old', title: 'Old', url: 'https://example.com/old', date: (now - 31 * 86_400_000) / 1000 },
            { gid: 'new', title: 'New', url: 'https://example.com/new', date: now / 1000 },
        ]);
        await processPersonalFollows(now);
        expect(mocks.send).toHaveBeenCalledOnce();
        expect(mocks.send.mock.calls[0]![1].content).toContain('New');
        expect(mocks.send.mock.calls[0]![1].content).not.toContain('Old');
        expect(await UserFollowEvent.count()).toBe(1);
    });

    it('rechecks delivery mode when a follow changes after the pending snapshot', async () => {
        const record = await follow();
        await manager.configure('owner', { timezone: 'UTC', quietStart: null, quietEnd: null, digestAt: '23:00' });
        const claim = manager.claim.bind(manager);
        vi.spyOn(manager, 'claim').mockImplementationOnce(async (...args) => {
            await manager.add('owner', record.provider, record.target, record.label, 'digest');
            return claim(...args);
        });
        await processPersonalFollows(now);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await UserFollowEvent.count({ where: { mode: 'digest', status: 'pending' } })).toBe(1);
    });

    it.each(['quiet', 'digest-time', 'timezone'])('rechecks changed %s preferences before claiming a private update', async change => {
        await follow('twitch', change === 'quiet' ? 'immediate' : 'digest');
        await manager.configure('owner', { timezone: 'UTC', quietStart: null, quietEnd: null, digestAt: '09:00' });
        const claim = manager.claim.bind(manager);
        vi.spyOn(manager, 'claim').mockImplementationOnce(async (...args) => {
            await manager.configure('owner', {
                timezone: change === 'timezone' ? 'Pacific/Pago_Pago' : 'UTC',
                quietStart: change === 'quiet' ? '00:00' : null,
                quietEnd: change === 'quiet' ? '00:00' : null,
                digestAt: change === 'digest-time' ? '23:00' : '09:00',
            });
            return claim(...args);
        });
        await processPersonalFollows(now);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(1);
        expect((await manager.preferences('owner')).lastDigestDate).toBeNull();
    });

    it.each(['quiet', 'digest-time', 'timezone'])('stops later digest pages when %s preferences change during delivery', async change => {
        const record = await follow('steam', 'digest');
        mocks.steam.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ gid: `change-${index}`, title: 'x'.repeat(140), url: `https://example.com/${index}${'1'.repeat(130)}`, date: now / 1000 })));
        await manager.configure('owner', { timezone: 'UTC', quietStart: null, quietEnd: null, digestAt: '09:00' });
        mocks.send.mockImplementationOnce(async () => {
            await manager.configure('owner', {
                timezone: change === 'timezone' ? 'Pacific/Pago_Pago' : 'UTC',
                quietStart: change === 'quiet' ? '00:00' : null,
                quietEnd: change === 'quiet' ? '00:00' : null,
                digestAt: change === 'digest-time' ? '23:00' : '09:00',
            });
            return { status: 'sent', message: { id: 'first', channel_id: 'channel' } };
        });
        await processPersonalFollows(now);
        expect(mocks.send).toHaveBeenCalledOnce();
        expect(await UserFollowEvent.count({ where: { followId: record.id, status: 'sent' } })).toBeGreaterThan(0);
        expect(await UserFollowEvent.count({ where: { followId: record.id, status: 'pending' } })).toBeGreaterThan(0);
        expect((await manager.preferences('owner')).lastDigestDate).toBe('2026-10-07');
    });

    it.each(['provider', 'claim'])('honors quiet hours reached while waiting for the %s stage', async stage => {
        await follow();
        await manager.configure('owner', { timezone: 'UTC', quietStart: '10:01', quietEnd: '11:00', digestAt: '09:00' });
        if (stage === 'provider') mocks.twitch.mockImplementationOnce(async () => {
            vi.setSystemTime(now + 120_000);
            return [{ id: 'stream', user_login: 'example', user_name: 'Example', title: 'Live', started_at: new Date(now).toISOString() }];
        });
        else {
            const claim = manager.claim.bind(manager);
            vi.spyOn(manager, 'claim').mockImplementationOnce(async (...args) => {
                vi.setSystemTime(now + 120_000);
                return claim(...args);
            });
        }
        await processPersonalFollows(now);
        expect(mocks.send).not.toHaveBeenCalled();
        expect(await UserFollowEvent.count({ where: { status: 'pending' } })).toBe(1);
    });

    it('keeps polling after provider failures and schedules recovery even when storage fails', async () => {
        await follow();
        mocks.twitch.mockRejectedValueOnce(new Error('provider down'));
        expect((await processPersonalFollows(now)).errors).toBe(1);
        await processPersonalFollows(now + 120_000);
        expect(mocks.send).toHaveBeenCalledOnce();
        const prune = vi.spyOn(manager, 'prune').mockRejectedValueOnce(new Error('database down'));
        const queue = new TestJobQueue();
        await registerPersonalFollowJobs(queue);
        const schedule = vi.spyOn(queue, 'schedule');
        const { done } = await runJobHandler(queue, 'personal-follows:run', {});
        expect(done).toHaveBeenCalled();
        expect(schedule).toHaveBeenCalled();
        prune.mockRestore();
    });

    it('suppresses overlapping job loops while a send is pending', async () => {
        await follow();
        let reached!: () => void;
        let release!: () => void;
        const started = new Promise<void>(resolve => { reached = resolve; });
        const waiting = new Promise<void>(resolve => { release = resolve; });
        mocks.send.mockImplementationOnce(async () => { reached(); await waiting; return { status: 'sent', message: { id: 'dm' } }; });
        const first = processPersonalFollows(now);
        try {
            await started;
            await processPersonalFollows(now);
            expect(mocks.send).toHaveBeenCalledOnce();
        } finally { release(); await first; }
    });
});
