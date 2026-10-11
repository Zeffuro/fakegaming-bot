import type { Transaction } from 'sequelize';
import { PersonalNotificationPause } from '../models/personal-notification-pause.js';
import { UserConfig } from '../models/user-config.js';
import { parseReminderTime } from '../utils/reminderTime.js';
import type { PersonalNotificationPauseInput, PersonalNotificationPausePreferences } from '../api/personalNotificationPause.js';
import { serializedTransaction } from './serializedTransaction.js';
import { PersonalError, requirePersonalTime } from './productivityShared.js';

function timezoneFor(value?: string | null): string {
    const timezone = value?.trim() || 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }); return timezone; } catch { return 'UTC'; }
}
export function personalNotificationsPaused(row: PersonalNotificationPause | null, now = Date.now()): boolean {
    return Boolean(row?.enabled && (row.resumeAt === null || Number(row.resumeAt) > now));
}
export async function lockPersonalNotificationPause(userId: string, transaction: Transaction): Promise<PersonalNotificationPause | null> {
    return PersonalNotificationPause.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
}
function preferences(row: PersonalNotificationPause | null, timezone: string, now: number): PersonalNotificationPausePreferences {
    const enabled = personalNotificationsPaused(row, now);
    return { enabled, resumeAt: enabled && row?.resumeAt !== null ? Number(row?.resumeAt) : null, timezone, version: row?.version ?? 0 };
}
export class PersonalNotificationPauseManager {
    constructor(private readonly now: () => number = Date.now) {}
    async preferences(userId: string): Promise<PersonalNotificationPausePreferences> {
        const [row, user] = await Promise.all([PersonalNotificationPause.findByPk(userId), UserConfig.findByPk(userId)]);
        return preferences(row, timezoneFor(user?.timezone), this.now());
    }
    async isPaused(userId: string, now = this.now()): Promise<boolean> {
        return personalNotificationsPaused(await PersonalNotificationPause.findByPk(userId), now);
    }
    async configure(userId: string, input: PersonalNotificationPauseInput): Promise<PersonalNotificationPausePreferences> {
        if (!userId || typeof input.enabled !== 'boolean' || !Number.isSafeInteger(input.version) || input.version < 0
            || (input.resumeAt !== null && typeof input.resumeAt !== 'string') || typeof input.timezone !== 'string') throw new PersonalError('invalid');
        return serializedTransaction(PersonalNotificationPause.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            const user = await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const timezone = timezoneFor(user?.timezone);
            if (input.timezone !== timezone) throw new PersonalError('stale');
            const row = await lockPersonalNotificationPause(userId, transaction);
            if ((row?.version ?? 0) !== input.version || input.version >= 2147483647) throw new PersonalError('stale');
            let resumeAt: number | null = null;
            if (input.resumeAt !== null) {
                if (!input.enabled || !/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?$/.test(input.resumeAt.trim())) throw new PersonalError('invalid');
                const parsed = parseReminderTime(input.resumeAt, timezone, this.now());
                if (!parsed) throw new PersonalError('invalid');
                requirePersonalTime(parsed.timestamp, this.now()); resumeAt = parsed.timestamp;
            }
            const values = { userId, enabled: input.enabled, resumeAt, version: input.version + 1 };
            return preferences(row ? await row.update(values, { transaction }) : await PersonalNotificationPause.create(values, { transaction }), timezone, this.now());
        });
    }
    async deliver<T>(userId: string, send: () => Promise<T>): Promise<{ paused: true } | { paused: false; value: T }> {
        return serializedTransaction(PersonalNotificationPause.sequelize!, async transaction => {
            await UserConfig.findOrCreate({ where: { discordId: userId }, defaults: { discordId: userId }, transaction });
            await UserConfig.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            const row = await lockPersonalNotificationPause(userId, transaction);
            if (personalNotificationsPaused(row, this.now())) return { paused: true };
            // Hold the owner lock through send; callbacks must not open transactions.
            return { paused: false, value: await send() };
        });
    }
}
