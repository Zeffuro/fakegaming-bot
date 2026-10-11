import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { MorningBriefingDelivery, MorningBriefingSettings } from '../models/morning-briefing.js';
import { UserConfig } from '../models/user-config.js';
import type { MorningBriefingPreferences } from '../api/morningBriefings.js';
import { serializedTransaction } from './serializedTransaction.js';
import { PersonalError } from './productivityShared.js';
import { followLocalTime } from './userFollowManager.js';
import { lockPersonalNotificationPause, personalNotificationsPaused } from './personalNotificationPauseManager.js';

export const BRIEFING_WINDOW_MINUTES = 120;
export function briefingTimezone(value?: string | null): string {
    const timezone = value?.trim() || 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); return timezone; } catch { return 'UTC'; }
}

function withinWindow(settings: MorningBriefingPreferences, now: number, expectedDay?: string): boolean {
    const local = followLocalTime(settings.timezone, now);
    const [hour, minute] = settings.localTime.split(':').map(Number);
    const elapsed = local.minutes - (hour! * 60 + minute!);
    return settings.enabled && (!expectedDay || expectedDay === local.date) && elapsed >= 0 && elapsed <= BRIEFING_WINDOW_MINUTES;
}

export class MorningBriefingManager {
    async preferences(userId: string): Promise<MorningBriefingPreferences> {
        const [settings, user] = await Promise.all([MorningBriefingSettings.findByPk(userId), UserConfig.findByPk(userId)]);
        return { enabled: settings?.enabled ?? false, localTime: settings?.localTime ?? '09:00',
            version: settings?.version ?? 0, timezone: briefingTimezone(user?.timezone) };
    }

    async configure(userId: string, input: MorningBriefingPreferences): Promise<MorningBriefingPreferences> {
        if (!userId || typeof input.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime)
            || !Number.isSafeInteger(input.version) || input.version < 0) throw new PersonalError('invalid');
        return serializedTransaction(MorningBriefingSettings.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            const user = await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const timezone = briefingTimezone(user?.timezone);
            if (input.timezone !== timezone) throw new PersonalError('stale');
            const row = await MorningBriefingSettings.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if ((row?.version ?? 0) !== input.version) throw new PersonalError('stale');
            const values = { enabled: input.enabled, localTime: input.localTime, version: input.version + 1 };
            if (row) await row.update(values, { transaction });
            else await MorningBriefingSettings.create({ userId, ...values }, { transaction });
            return { ...values, timezone };
        });
    }

    async active(): Promise<string[]> {
        return (await MorningBriefingSettings.findAll({ where: { enabled: true }, attributes: ['userId'] })).map(row => row.userId);
    }

    async claim(userId: string, now: () => number): Promise<MorningBriefingDelivery | null> {
        return serializedTransaction(MorningBriefingSettings.sequelize!, async transaction => {
            const user = await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const pause = await lockPersonalNotificationPause(userId, transaction);
            if (personalNotificationsPaused(pause, now())) return null;
            const settings = await MorningBriefingSettings.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if (!settings) return null;
            const timezone = briefingTimezone(user?.timezone); const current = now();
            if (!withinWindow({ ...settings.get({ plain: true }), timezone } as MorningBriefingPreferences, current)) return null;
            const localDate = followLocalTime(timezone, current).date;
            const existing = await MorningBriefingDelivery.findOne({ where: { userId, localDate }, transaction, lock: transaction.LOCK.UPDATE });
            if (existing) {
                if (existing.status !== 'rejected' || existing.attempts >= 3 || Number(existing.retryAt) > current) return null;
                return existing.update({ status: 'sending', attempts: existing.attempts + 1, claimToken: randomUUID(), attemptedAt: current,
                    retryAt: null, timezone, settingsVersion: settings.version }, { transaction });
            }
            return MorningBriefingDelivery.create({ id: randomUUID(), userId, localDate, timezone, settingsVersion: settings.version,
                status: 'sending', attempts: 1, claimToken: randomUUID(), attemptedAt: current, retryAt: null }, { transaction });
        });
    }

    async deliver(claim: MorningBriefingDelivery, now: () => number,
        send: (stillEligible: () => boolean) => Promise<'sent' | 'rejected' | 'uncertain' | 'skipped'>): Promise<string> {
        return serializedTransaction(MorningBriefingSettings.sequelize!, async transaction => {
            const user = await UserConfig.findByPk(claim.userId, { transaction, lock: transaction.LOCK.UPDATE });
            const pause = await lockPersonalNotificationPause(claim.userId, transaction);
            const settings = await MorningBriefingSettings.findByPk(claim.userId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await MorningBriefingDelivery.findByPk(claim.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!row || row.status !== 'sending' || row.claimToken !== claim.claimToken) return 'skipped';
            const current = now(); const timezone = briefingTimezone(user?.timezone);
            if (personalNotificationsPaused(pause, current)) {
                await row.update({ status: 'rejected', attempts: Math.max(0, row.attempts - 1), retryAt: current + 60_000 }, { transaction });
                return 'skipped';
            }
            const stillEligible = () => Boolean(settings && settings.version === claim.settingsVersion && timezone === claim.timezone
                && withinWindow({ ...settings.get({ plain: true }), timezone } as MorningBriefingPreferences, now(), claim.localDate));
            // Keep preference locks until send settlement so disable/timezone updates cannot overtake a send.
            let status: 'sent' | 'rejected' | 'uncertain' | 'skipped' = 'skipped';
            if (stillEligible()) { try { status = await send(stillEligible); } catch { status = 'uncertain'; } }
            await row.update({ status, retryAt: status === 'rejected' && row.attempts < 3 ? current + row.attempts * 60_000 : null }, { transaction });
            return status;
        });
    }

    async recover(now: number): Promise<void> {
        await serializedTransaction(MorningBriefingDelivery.sequelize!, async transaction => {
            await MorningBriefingDelivery.update({ status: 'uncertain', retryAt: null }, {
                where: { status: 'sending', attemptedAt: { [Op.lt]: now - 5 * 60_000 } }, transaction,
            });
            await MorningBriefingDelivery.destroy({ where: { attemptedAt: { [Op.lt]: now - 90 * 86_400_000 } }, transaction });
        });
    }
}
