import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { UserFollow, UserFollowEvent, UserFollowSettings } from '../models/personal-notifications.js';
import { parseHHmmToMinutes, toMillis } from '../utils/time.js';
import { serializedTransaction } from './serializedTransaction.js';

export interface FollowEventInput { eventKey: string; title: string; url: string; occurredAt: number }
export interface FollowPreferences { timezone: string; quietStart: string | null; quietEnd: string | null; digestAt: string; lastDigestDate: string | null }

export function followLocalTime(timezone: string, now: number): { date: string; minutes: number } {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function followInQuietHours(settings: FollowPreferences, now: number): boolean {
    const start = settings.quietStart === null ? null : parseHHmmToMinutes(settings.quietStart);
    const end = settings.quietEnd === null ? null : parseHHmmToMinutes(settings.quietEnd);
    if (start === null || end === null) return false;
    const current = followLocalTime(settings.timezone, now).minutes;
    return start === end || (start < end ? current >= start && current < end : current >= start || current < end);
}

export class UserFollowManager {
    async list(userId: string): Promise<UserFollow[]> {
        return UserFollow.findAll({ where: { userId }, order: [['provider', 'ASC'], ['label', 'ASC']] });
    }

    async active(): Promise<UserFollow[]> { return UserFollow.findAll({ where: { paused: false } }); }

    async add(userId: string, provider: 'twitch' | 'steam', target: string, label: string, mode: 'immediate' | 'digest'): Promise<UserFollow> {
        const normalized = target.trim().toLowerCase().replace(/^@/, '');
        if (!userId || !['twitch', 'steam'].includes(provider) || !['immediate', 'digest'].includes(mode)
            || (provider === 'twitch' ? !/^[a-z0-9_]{1,25}$/.test(normalized) : !/^[1-9]\d{0,9}$/.test(normalized))) throw new Error('invalid-follow');
        return serializedTransaction(UserFollow.sequelize!, async transaction => {
            const where = { userId, provider, target: normalized };
            const existing = await UserFollow.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
            if (existing) {
                await existing.update({ mode, paused: false, label: label.slice(0, 200) }, { transaction });
                await UserFollowEvent.update({ mode }, { where: { followId: existing.id, status: 'pending' }, transaction });
                return existing;
            }
            if (await UserFollow.count({ where: { userId }, transaction }) >= 30
                || await UserFollow.count({ transaction }) >= 500) throw new Error('follow-capacity');
            return UserFollow.create({ id: randomUUID(), ...where, label: label.slice(0, 200), mode, paused: false, cursor: null }, { transaction });
        });
    }

    async change(userId: string, id: string, action: 'pause' | 'resume' | 'remove'): Promise<boolean> {
        return serializedTransaction(UserFollow.sequelize!, async transaction => {
            const where = { userId, id };
            if (action === 'remove') {
                const removed = await UserFollow.destroy({ where, transaction });
                if (removed) await UserFollowEvent.destroy({ where: { userId, followId: id }, transaction });
                return removed === 1;
            }
            const [changed] = await UserFollow.update({ paused: action === 'pause' }, { where, transaction });
            return changed === 1;
        });
    }

    async preferences(userId: string, fallbackTimezone = 'UTC'): Promise<FollowPreferences> {
        return serializedTransaction(UserFollowSettings.sequelize!, async transaction => {
            const [stored] = await UserFollowSettings.findOrCreate({ where: { userId }, defaults: {
                userId, timezone: fallbackTimezone, quietStart: null, quietEnd: null, digestAt: '09:00', lastDigestDate: null,
            }, transaction });
            return stored;
        });
    }

    async configure(userId: string, input: Omit<FollowPreferences, 'lastDigestDate'>): Promise<void> {
        followLocalTime(input.timezone, Date.now());
        if (parseHHmmToMinutes(input.digestAt) === null
            || Boolean(input.quietStart) !== Boolean(input.quietEnd)
            || (input.quietStart !== null && parseHHmmToMinutes(input.quietStart) === null)
            || (input.quietEnd !== null && parseHHmmToMinutes(input.quietEnd) === null)) throw new Error('invalid-follow-settings');
        await serializedTransaction(UserFollowSettings.sequelize!, async transaction => {
            const existing = await UserFollowSettings.findByPk(userId, { transaction });
            if (existing) await existing.update(input, { transaction });
            else await UserFollowSettings.create({ userId, ...input, lastDigestDate: null }, { transaction });
        });
    }

    async observe(id: string, events: readonly FollowEventInput[], cursor: string | null): Promise<void> {
        await serializedTransaction(UserFollow.sequelize!, async transaction => {
            const follow = await UserFollow.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!follow || follow.paused) return;
            for (const event of events.slice(-20)) {
                if (event.occurredAt < Math.max(toMillis(follow.createdAt), Date.now() - 30 * 86_400_000) || !Number.isSafeInteger(event.occurredAt)
                    || event.occurredAt > Date.now() + 86_400_000 || !event.eventKey || event.eventKey.length > 128
                    || event.url.length > 1000 || /[<>\r\n]/.test(event.url)) continue;
                let url: URL;
                try { url = new URL(event.url); } catch { continue; }
                if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
                await UserFollowEvent.findOrCreate({
                    where: { followId: id, eventKey: event.eventKey },
                    defaults: { id: randomUUID(), userId: follow.userId, followId: id, ...event, url: url.href,
                        title: event.title.slice(0, 500), mode: follow.mode, status: 'pending', attemptedAt: null }, transaction,
                });
            }
            await follow.update({ cursor }, { transaction });
        });
    }

    async pending(): Promise<UserFollowEvent[]> {
        const activeIds = (await this.active()).map(follow => follow.id);
        return UserFollowEvent.findAll({ where: { status: 'pending', followId: { [Op.in]: activeIds } }, order: [['occurredAt', 'ASC']] });
    }

    async claim(
        userId: string, ids: readonly string[], digestDate?: string, mode?: 'immediate' | 'digest',
        timing: { now?: number | (() => number); expectedDigestDate?: string } = {},
    ): Promise<UserFollowEvent[]> {
        const expectedDigestDate = timing.expectedDigestDate ?? digestDate;
        return serializedTransaction(UserFollowEvent.sequelize!, async transaction => {
            const records = await UserFollowEvent.findAll({ where: { userId, id: { [Op.in]: ids }, status: 'pending', ...(mode ? { mode } : {}) }, transaction });
            if (records.length === 0) return [];
            const active = await UserFollow.findAll({ where: { userId, paused: false, id: { [Op.in]: records.map(record => record.followId) } }, transaction, lock: transaction.LOCK.UPDATE });
            const activeModes = new Map(active.map(follow => [follow.id, follow.mode]));
            const selected = records.filter(record => activeModes.get(record.followId) === record.mode);
            if (selected.length === 0) return [];
            if (digestDate || mode === 'digest') {
                await UserFollowSettings.findOrCreate({ where: { userId }, defaults: { userId, timezone: 'UTC', digestAt: '09:00', quietStart: null, quietEnd: null, lastDigestDate: null }, transaction });
            }
            const settings = await UserFollowSettings.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const now = typeof timing.now === 'function' ? timing.now() : timing.now ?? Date.now();
            if (settings && followInQuietHours(settings, now)) return [];
            if (settings && (mode === 'digest' || expectedDigestDate)) {
                const local = followLocalTime(settings.timezone, now);
                if ((expectedDigestDate && local.date !== expectedDigestDate) || local.minutes < (parseHHmmToMinutes(settings.digestAt) ?? 540)) return [];
            }
            if (digestDate) {
                const [changed] = await UserFollowSettings.update({ lastDigestDate: digestDate }, { where: {
                    userId, [Op.or]: [{ lastDigestDate: null }, { lastDigestDate: { [Op.ne]: digestDate } }],
                }, transaction });
                if (changed === 0) return [];
            }
            const claimed: UserFollowEvent[] = [];
            for (const record of selected) {
                const [changed] = await UserFollowEvent.update({ status: 'sending', attemptedAt: now }, { where: { id: record.id, status: 'pending', mode: record.mode }, transaction });
                if (changed === 1) claimed.push(record);
            }
            return claimed;
        });
    }

    async settle(userId: string, ids: readonly string[], status: 'sent' | 'pending' | 'uncertain', digestDate?: string): Promise<void> {
        await serializedTransaction(UserFollowEvent.sequelize!, async transaction => {
            if (status === 'pending' && digestDate) await UserFollowSettings.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            await UserFollowEvent.update({ status }, { where: { userId, id: { [Op.in]: ids }, status: 'sending' }, transaction });
            if (status === 'pending' && digestDate) {
                await UserFollowSettings.update({ lastDigestDate: null }, { where: { userId, lastDigestDate: digestDate }, transaction });
            }
        });
    }

    async prune(now = Date.now()): Promise<void> {
        await serializedTransaction(UserFollowEvent.sequelize!, async transaction => {
            await UserFollowEvent.update({ status: 'uncertain' }, { where: { status: 'sending', attemptedAt: { [Op.lt]: now - 5 * 60_000 } }, transaction });
            await UserFollowEvent.destroy({ where: { occurredAt: { [Op.lt]: now - 30 * 86_400_000 } }, transaction });
        });
    }
}
