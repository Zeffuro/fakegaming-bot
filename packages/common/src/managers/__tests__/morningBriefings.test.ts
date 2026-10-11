import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MorningBriefingDelivery, MorningBriefingSettings } from '../../models/morning-briefing.js';
import { UserConfig } from '../../models/user-config.js';
import { MorningBriefingManager, briefingTimezone } from '../morningBriefingManager.js';

const manager = new MorningBriefingManager();
const morning = Date.parse('2026-10-10T07:00:00Z');
const configure = (userId = 'owner', enabled = true) => manager.configure(userId, { enabled, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 });

beforeEach(async () => {
    await MorningBriefingDelivery.destroy({ where: {} }); await MorningBriefingSettings.destroy({ where: {} });
    await UserConfig.destroy({ where: {} }); await UserConfig.create({ discordId: 'owner', timezone: 'Europe/Amsterdam' });
});

describe('durable opt-in morning briefing', () => {
    it('defaults off without writing preferences and validates strictly', async () => {
        expect(await manager.preferences('owner')).toEqual({ enabled: false, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 0 });
        expect(await MorningBriefingSettings.count()).toBe(0); expect(await manager.claim('owner', () => morning)).toBeNull();
        expect(briefingTimezone('nonsense')).toBe('UTC');
        await expect(manager.configure('owner', { enabled: true, localTime: '24:00', timezone: 'Europe/Amsterdam', version: 0 })).rejects.toMatchObject({ code: 'invalid' });
        await expect(manager.configure('owner', { enabled: true, localTime: '09:00', timezone: 'UTC', version: 0 })).rejects.toMatchObject({ code: 'stale' });
    });
    it('serializes independent claimers and keeps one daily binding after restart', async () => {
        await configure();
        const claims = await Promise.all([manager.claim('owner', () => morning), new MorningBriefingManager().claim('owner', () => morning)]);
        const claim = claims.find(row => row !== null)!;
        expect(claims.filter(Boolean)).toHaveLength(1);
        const send = vi.fn(async () => 'sent' as const);
        expect(await manager.deliver(claim, () => morning, send)).toBe('sent');
        expect(await manager.deliver(claim, () => morning, send)).toBe('skipped');
        expect(send).toHaveBeenCalledOnce();
        expect(await new MorningBriefingManager().claim('owner', () => morning + 60_000)).toBeNull();
        expect(await manager.claim('owner', () => morning + 86_400_000)).not.toBeNull();
    });
    it('retries only explicit rejection with bounded backoff and token protection', async () => {
        await configure(); const first = (await manager.claim('owner', () => morning))!;
        await manager.deliver(first, () => morning, async () => 'rejected');
        expect(await manager.claim('owner', () => morning + 59_999)).toBeNull();
        const second = (await manager.claim('owner', () => morning + 60_000))!;
        const send = vi.fn(async () => 'sent' as const);
        expect(await manager.deliver(first, () => morning + 60_000, send)).toBe('skipped'); expect(send).not.toHaveBeenCalled();
        await manager.deliver(second, () => morning + 60_000, async () => 'rejected');
        expect(await manager.claim('owner', () => morning + 179_999)).toBeNull();
        const third = (await manager.claim('owner', () => morning + 180_000))!;
        await manager.deliver(third, () => morning + 180_000, async () => 'rejected');
        expect(await manager.claim('owner', () => morning + 1_800_000)).toBeNull();
        expect(await MorningBriefingDelivery.findByPk(first.id)).toMatchObject({ status: 'rejected', attempts: 3 });
    });
    it.each(['uncertain', 'throw', 'interrupted'] as const)('does not duplicate %s delivery after restart', async outcome => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!;
        if (outcome !== 'interrupted') await manager.deliver(claim, () => morning, async () => {
            if (outcome === 'throw') throw new Error('Lost remote response'); return outcome;
        });
        await new MorningBriefingManager().recover(morning + 360_000);
        expect(await manager.claim('owner', () => morning + 360_000)).toBeNull();
        expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'uncertain' });
    });
    it('suppresses send after settings disable, version change or authoritative timezone change', async () => {
        for (const change of ['disable', 'time', 'timezone']) {
            await MorningBriefingDelivery.destroy({ where: {} }); await MorningBriefingSettings.destroy({ where: {} });
            await UserConfig.update({ timezone: 'Europe/Amsterdam' }, { where: { discordId: 'owner' } }); await configure();
            const claim = (await manager.claim('owner', () => morning))!;
            if (change === 'timezone') await UserConfig.update({ timezone: 'UTC' }, { where: { discordId: 'owner' } });
            else await manager.configure('owner', { enabled: change !== 'disable', localTime: change === 'time' ? '10:00' : '09:00', timezone: 'Europe/Amsterdam', version: 1 });
            const send = vi.fn(async () => 'sent' as const);
            expect(await manager.deliver(claim, () => morning, send)).toBe('skipped'); expect(send).not.toHaveBeenCalled();
        }
    });
    it('checks settings and clock after transaction lock waits', async () => {
        await configure();
        const original = MorningBriefingSettings.findByPk.bind(MorningBriefingSettings);
        const spy = vi.spyOn(MorningBriefingSettings, 'findByPk').mockImplementationOnce(async (id, options) => {
            expect(options?.lock).toBeDefined();
            await MorningBriefingSettings.update({ enabled: false }, { where: { userId: 'owner' }, transaction: options?.transaction });
            return original(id, options);
        });
        try { expect(await manager.claim('owner', () => morning)).toBeNull(); } finally { spy.mockRestore(); }
        await MorningBriefingSettings.update({ enabled: true }, { where: { userId: 'owner' } });
        expect(await manager.claim('owner', () => morning - 1)).toBeNull();
        expect(await manager.claim('owner', () => morning + 121 * 60_000)).toBeNull();
    });
    it('handles skipped DST clock time and repeated clock hour once per local date', async () => {
        await manager.configure('owner', { enabled: true, localTime: '02:30', timezone: 'Europe/Amsterdam', version: 0 });
        expect(await manager.claim('owner', () => Date.parse('2026-03-29T00:59:00Z'))).toBeNull();
        const spring = (await manager.claim('owner', () => Date.parse('2026-03-29T01:00:00Z')))!;
        expect(spring.localDate).toBe('2026-03-29'); await manager.deliver(spring, () => Date.parse('2026-03-29T01:00:00Z'), async () => 'sent');
        const firstFall = (await manager.claim('owner', () => Date.parse('2026-10-25T00:30:00Z')))!;
        await manager.deliver(firstFall, () => Date.parse('2026-10-25T00:30:00Z'), async () => 'sent');
        expect(await manager.claim('owner', () => Date.parse('2026-10-25T01:30:00Z'))).toBeNull();
    });
    it('never replays rejected old days and consumes empty days once', async () => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!;
        await manager.deliver(claim, () => morning, async () => 'rejected');
        const next = (await manager.claim('owner', () => morning + 86_400_000))!;
        expect(next.localDate).toBe('2026-10-11'); await manager.deliver(next, () => morning + 86_400_000, async () => 'skipped');
        expect(await manager.claim('owner', () => morning + 86_460_000)).toBeNull();
    });
    it('invalidates a prepared payload if its reads cross the local day or delivery window', async () => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!; let current = morning;
        expect(await manager.deliver(claim, () => current, async stillEligible => {
            current += 121 * 60_000; expect(stillEligible()).toBe(false); return 'skipped';
        })).toBe('skipped');
    });
    it('prunes historical daily bindings without removing recent uncertain or skipped days', async () => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!;
        await manager.deliver(claim, () => morning, async () => 'skipped');
        await MorningBriefingDelivery.create({ id: 'old', userId: 'owner', localDate: '2026-01-01', timezone: 'UTC',
            settingsVersion: 1, status: 'sending', attempts: 1, claimToken: 'old', attemptedAt: morning - 91 * 86_400_000, retryAt: null });
        await MorningBriefingDelivery.create({ id: 'recent', userId: 'owner', localDate: '2026-10-09', timezone: 'UTC',
            settingsVersion: 1, status: 'uncertain', attempts: 1, claimToken: 'recent', attemptedAt: morning - 86_400_000, retryAt: null });
        await manager.recover(morning);
        expect(await MorningBriefingDelivery.findByPk('old')).toBeNull();
        expect(await MorningBriefingDelivery.findByPk('recent')).not.toBeNull();
        expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'skipped' });
    });
    it('retains an uncertain daily binding if storage fails after a successful remote send', async () => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!;
        const send = vi.fn(async () => 'sent' as const);
        const update = vi.spyOn(MorningBriefingDelivery.prototype, 'update').mockRejectedValueOnce(new Error('Settlement storage failed'));
        try { await expect(manager.deliver(claim, () => morning, send)).rejects.toThrow('Settlement storage failed'); }
        finally { update.mockRestore(); }
        expect(send).toHaveBeenCalledOnce(); expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'sending' });
        await new MorningBriefingManager().recover(morning + 360_000);
        expect(await manager.claim('owner', () => morning + 360_000)).toBeNull();
        expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'uncertain' });
    });
    it('holds authoritative preference locks until the in-flight send settles', async () => {
        await configure(); const claim = (await manager.claim('owner', () => morning))!;
        let release: () => void = () => undefined; let started: () => void = () => undefined;
        const sending = new Promise<void>(resolve => { started = resolve; });
        const remote = new Promise<void>(resolve => { release = resolve; });
        const delivery = manager.deliver(claim, () => morning, async () => { started(); await remote; return 'sent'; });
        await sending;
        let disabled = false;
        const change = manager.configure('owner', { enabled: false, localTime: '09:00', timezone: 'Europe/Amsterdam', version: 1 }).then(() => { disabled = true; });
        expect(disabled).toBe(false); release(); await delivery; await change;
        expect(await manager.preferences('owner')).toMatchObject({ enabled: false });
        expect(await MorningBriefingDelivery.findByPk(claim.id)).toMatchObject({ status: 'sent' });
    });
});
