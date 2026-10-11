import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalNotificationPause } from '../../models/personal-notification-pause.js';
import { UserConfig } from '../../models/user-config.js';
import { PersonalNotificationPauseManager } from '../personalNotificationPauseManager.js';
import { MorningBriefingManager } from '../morningBriefingManager.js';
import { MorningBriefingDelivery, MorningBriefingSettings } from '../../models/morning-briefing.js';

describe('account-wide personal notification pause', () => {
    let now = Date.parse('2026-10-10T08:00Z');
    const manager = new PersonalNotificationPauseManager(() => now);
    const input = (enabled = true, version = 0) => ({ enabled, resumeAt: null, timezone: 'Europe/Amsterdam', version });
    beforeEach(async () => {
        now = Date.parse('2026-10-10T08:00Z');
        await PersonalNotificationPause.destroy({ where: {} }); await MorningBriefingDelivery.destroy({ where: {} }); await MorningBriefingSettings.destroy({ where: {} });
        await UserConfig.findOrCreate({ where: { discordId: 'pause-owner' }, defaults: { discordId: 'pause-owner' } });
        await UserConfig.update({ timezone: 'Europe/Amsterdam' }, { where: { discordId: 'pause-owner' } });
    });
    afterEach(() => vi.restoreAllMocks());
    it('defaults off, persists separately per owner and resumes automatically at the exact saved-zone deadline', async () => {
        expect(await manager.preferences('pause-owner')).toEqual({ enabled: false, resumeAt: null, timezone: 'Europe/Amsterdam', version: 0 });
        expect(await PersonalNotificationPause.count()).toBe(0);
        const paused = await manager.configure('pause-owner', { ...input(), resumeAt: '2026-10-10T11:30' });
        expect(paused).toEqual({ enabled: true, resumeAt: Date.parse('2026-10-10T09:30Z'), timezone: 'Europe/Amsterdam', version: 1 });
        expect(await manager.isPaused('other')).toBe(false);
        expect(await new PersonalNotificationPauseManager(() => now).isPaused('pause-owner')).toBe(true);
        now = Date.parse('2026-10-10T09:30Z'); expect(await manager.isPaused('pause-owner')).toBe(false);
        expect(await manager.preferences('pause-owner')).toMatchObject({ enabled: false, resumeAt: null, version: 1 });
        expect(await manager.configure('pause-owner', input(true, 1))).toMatchObject({ enabled: true, resumeAt: null, version: 2 });
        expect(await manager.configure('pause-owner', input(false, 2))).toMatchObject({ enabled: false, version: 3 });
    });
    it('rejects stale owner versions/timezones and invalid resume dates without replacing current settings', async () => {
        await manager.configure('pause-owner', input());
        await expect(manager.configure('pause-owner', input(false))).rejects.toThrow('stale');
        await UserConfig.update({ timezone: 'UTC' }, { where: { discordId: 'pause-owner' } });
        await expect(manager.configure('pause-owner', input(false, 1))).rejects.toThrow('stale');
        for (const resumeAt of ['1h', '2026-10-10T07:00', '2026-02-30T12:00', '2026-03-29T02:30']) {
            await expect(manager.configure('pause-owner', { ...input(true, 1), timezone: 'UTC', resumeAt })).rejects.toThrow('invalid');
        }
        await expect(manager.configure('pause-owner', { ...input(false, 1), timezone: 'UTC', resumeAt: '2026-10-10T12:00' })).rejects.toThrow('invalid');
        expect(await manager.isPaused('pause-owner')).toBe(true);
    });
    it('serializes initial writes, blocks sends when paused and rolls back failed settings writes', async () => {
        const writes = await Promise.allSettled([manager.configure('pause-owner', input()), manager.configure('pause-owner', input())]);
        expect(writes.filter(value => value.status === 'fulfilled')).toHaveLength(1);
        const send = vi.fn(); expect(await manager.deliver('pause-owner', send)).toEqual({ paused: true }); expect(send).not.toHaveBeenCalled();
        await manager.configure('pause-owner', input(false, 1));
        vi.spyOn(PersonalNotificationPause.prototype, 'update').mockRejectedValueOnce(new Error('failed storage'));
        await expect(manager.configure('pause-owner', input(true, 2))).rejects.toThrow('failed storage');
        expect(await manager.isPaused('pause-owner')).toBe(false);
    });
    it('acknowledges a racing pause only after in-flight send settles and blocks all later sends', async () => {
        let reached!: () => void; let release!: () => void;
        const started = new Promise<void>(resolve => { reached = resolve; }); const wait = new Promise<void>(resolve => { release = resolve; });
        const first = manager.deliver('pause-owner', async () => { reached(); await wait; return 'sent'; });
        await started; let acknowledged = false;
        const change = manager.configure('pause-owner', input()).then(value => { acknowledged = true; return value; });
        await Promise.resolve(); expect(acknowledged).toBe(false); release();
        expect(await first).toEqual({ paused: false, value: 'sent' }); await change; expect(acknowledged).toBe(true);
        const send = vi.fn(); expect(await manager.deliver('pause-owner', send)).toEqual({ paused: true }); expect(send).not.toHaveBeenCalled();
    });
    it('suppresses briefing claims and preserves same-day retries when pause wins after claiming', async () => {
        const briefing = new MorningBriefingManager(); await briefing.configure('pause-owner', { enabled: true, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 });
        await manager.configure('pause-owner', input()); expect(await briefing.claim('pause-owner', () => now)).toBeNull();
        await manager.configure('pause-owner', input(false, 1)); const claim = (await briefing.claim('pause-owner', () => now))!;
        await manager.configure('pause-owner', input(true, 2)); const send = vi.fn();
        expect(await briefing.deliver(claim, () => now, send)).toBe('skipped'); expect(send).not.toHaveBeenCalled();
        expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'rejected', attempts: 0 });
        now += 61_000; await manager.configure('pause-owner', input(false, 3));
        const retry = (await briefing.claim('pause-owner', () => now))!;
        expect(await briefing.deliver(retry, () => now, async () => 'sent')).toBe('sent');
        now += 86_400_000 + 3 * 60 * 60_000;
        expect(await briefing.claim('pause-owner', () => now)).toBeNull();
    });
});
