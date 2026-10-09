import { Op, type Transaction } from 'sequelize';
import { ReminderConfig } from '../models/reminder-config.js';
import { ReminderDelivery } from '../models/reminder-interaction.js';

export type PersonalErrorCode = 'invalid' | 'missing' | 'stale' | 'capacity' | 'exists';

export class PersonalError extends Error {
    constructor(public readonly code: PersonalErrorCode) {
        super(code);
        this.name = 'PersonalError';
    }
}

export interface PersonalDeliveryScope {
    id: string;
    messageId: string;
    channelId: string;
}

export function requirePersonalText(value: string, max = 120): string {
    const text = value.trim();
    if (!text || text.length > max || !text.replace(/[\p{C}\p{Z}]/gu, '')) throw new PersonalError('invalid');
    return text;
}

export function requirePersonalTime(timestamp: number, now: number): void {
    if (!Number.isSafeInteger(timestamp) || timestamp <= now || timestamp - now > 3660 * 86_400_000) throw new PersonalError('invalid');
}

export async function createOwnedReminder(id: string, userId: string, message: string, timestamp: number, now: number, transaction: Transaction): Promise<void> {
    await ReminderConfig.create({ id, userId, message, timestamp, timespan: `${Math.max(0, timestamp - now)}ms`, completed: false }, { transaction });
}

export async function removeOwnedReminder(id: string | null, userId: string, transaction: Transaction): Promise<void> {
    if (!id) return;
    await ReminderConfig.destroy({ where: { id, userId }, transaction });
    await ReminderDelivery.update({ status: 'dismissed', finalized: true }, { where: { reminderId: id, userId, status: 'pending' }, transaction });
}

export async function consumePersonalDelivery(
    scope: PersonalDeliveryScope | undefined, userId: string, reminderId: string | null,
    status: 'dismissed' | 'snoozed', transaction: Transaction,
): Promise<void> {
    if (!scope) return;
    const [changed] = await ReminderDelivery.update({ status }, {
        where: { id: scope.id, userId, reminderId, messageId: scope.messageId, channelId: scope.channelId, status: 'delivered', expiresAt: { [Op.gt]: Date.now() } }, transaction,
    });
    if (changed !== 1) throw new PersonalError('stale');
}
