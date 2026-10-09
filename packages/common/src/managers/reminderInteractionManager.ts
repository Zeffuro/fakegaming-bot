import { randomUUID } from 'node:crypto';
import { literal, Op, type Transaction } from 'sequelize';
import { ReminderDraft, ReminderDelivery } from '../models/reminder-interaction.js';
import { ReminderConfig } from '../models/reminder-config.js';
import { serializedTransaction } from './serializedTransaction.js';

const DRAFT_LIFETIME_MS = 30 * 60_000;
export const REMINDER_DELIVERY_RETENTION_MS = 30 * 86_400_000;

export class ReminderInteractionManager {
    constructor(private readonly now: () => number = Date.now) {}

    async createDraft(userId: string, message: string): Promise<ReminderDraft> {
        if (!userId || !message || message.length > 1800) throw new Error('Invalid reminder draft');
        await this.prune();
        return this.transaction(transaction => ReminderDraft.create({
            id: randomUUID(), userId, message, expiresAt: this.now() + DRAFT_LIFETIME_MS, consumed: false,
        }, { transaction }));
    }

    async getDraft(id: string, userId: string): Promise<ReminderDraft | null> {
        return ReminderDraft.findOne({ where: { id, userId, consumed: false, expiresAt: { [Op.gt]: this.now() } } });
    }

    async scheduleDraft(id: string, userId: string, timestamp: number, timespan: string): Promise<boolean> {
        if (!this.validTime(timestamp, timespan)) return false;
        return this.transaction(async transaction => {
            const where = { id, userId, consumed: false, expiresAt: { [Op.gt]: this.now() } };
            const [changed] = await ReminderDraft.update({ consumed: true }, { where, transaction });
            if (changed !== 1) return false;
            const draft = await ReminderDraft.findByPk(id, { transaction });
            await ReminderConfig.create({ id: randomUUID(), userId, message: draft!.message, timestamp, timespan, completed: false }, { transaction });
            return true;
        });
    }

    async prepareDelivery(reminder: { id: string; userId: string; message: string }, scheduledAt: number): Promise<ReminderDelivery> {
        return this.transaction(async transaction => {
            const active = await ReminderDelivery.findOne({
                where: { reminderId: reminder.id, finalized: false }, transaction,
            });
            if (active) return active;
            const [delivery] = await ReminderDelivery.findOrCreate({
                where: { reminderId: reminder.id, scheduledAt },
                defaults: {
                    id: randomUUID(), reminderId: reminder.id, scheduledAt, sourceTimestamp: scheduledAt, userId: reminder.userId,
                    message: reminder.message, status: 'pending', messageId: null, channelId: null, attemptedAt: null, finalized: false,
                    expiresAt: this.now() + REMINDER_DELIVERY_RETENTION_MS,
                }, transaction,
            });
            return delivery;
        });
    }

    async markDelivered(id: string, messageId: string, channelId: string): Promise<void> {
        await this.transaction(transaction => ReminderDelivery.update({ status: 'delivered', messageId, channelId }, {
            where: { id, status: { [Op.in]: ['pending', 'sending'] } }, transaction,
        }));
    }

    async claimDelivery(id: string, expectedTimestamp?: number): Promise<boolean> {
        return this.transaction(async transaction => {
            const delivery = await ReminderDelivery.findByPk(id, { transaction });
            if (!delivery) return false;
            const source = await ReminderConfig.findOne({ where: { id: delivery.reminderId, userId: delivery.userId }, transaction, lock: transaction.LOCK.UPDATE });
            await delivery.reload({ transaction, lock: transaction.LOCK.UPDATE });
            if (!source || Number(source.timestamp) !== Number(delivery.sourceTimestamp)) {
                await ReminderDelivery.update({ status: 'dismissed', finalized: true }, { where: { id, status: 'pending' }, transaction });
                return false;
            }
            if (source.completed || (expectedTimestamp !== undefined && Number(source.timestamp) !== expectedTimestamp)) return false;
            const [changed] = await ReminderDelivery.update({ status: 'sending', attemptedAt: this.now() }, { where: { id, status: 'pending' }, transaction });
            return changed === 1;
        });
    }

    async releaseDelivery(id: string, retryTimestamp?: number): Promise<void> {
        await this.transaction(async transaction => {
            const delivery = await ReminderDelivery.findByPk(id, { transaction });
            if (!delivery) return;
            const source = await ReminderConfig.findOne({ where: { id: delivery.reminderId, userId: delivery.userId }, transaction, lock: transaction.LOCK.UPDATE });
            await delivery.reload({ transaction, lock: transaction.LOCK.UPDATE });
            const current = source && Number(source.timestamp) === Number(delivery.sourceTimestamp);
            const [changed] = await ReminderDelivery.update(current
                ? { status: 'pending', attemptedAt: null, sourceTimestamp: source.completed ? Number(source.timestamp) : retryTimestamp ?? Number(source.timestamp) }
                : { status: 'dismissed', finalized: true }, { where: { id, status: 'sending' }, transaction });
            if (changed && current && !source.completed && retryTimestamp !== undefined) await source.update({ timestamp: retryTimestamp }, { transaction });
        });
    }

    async markUncertain(id: string): Promise<void> {
        await this.transaction(transaction => ReminderDelivery.update({ status: 'uncertain' }, { where: { id, status: 'sending' }, transaction }));
    }

    async finalizeDelivery(id: string, nextTimestamp: number | null, triggeredAt: number): Promise<void> {
        await this.transaction(async transaction => {
            const source = await ReminderDelivery.findByPk(id, { transaction });
            if (!source) return;
            const reminder = await ReminderConfig.findOne({ where: { id: source.reminderId, userId: source.userId }, transaction, lock: transaction.LOCK.UPDATE });
            const [changed] = await ReminderDelivery.update({ finalized: true }, {
                where: { id, finalized: false, status: { [Op.in]: ['delivered', 'uncertain', 'snoozed', 'dismissed'] } }, transaction,
            });
            if (changed === 0) return;
            const delivery = await ReminderDelivery.findByPk(id, { transaction });
            if (!reminder || Number(reminder.timestamp) !== Number(delivery!.sourceTimestamp)) return;
            if (nextTimestamp === null) {
                if (!reminder.completed) await ReminderConfig.destroy({ where: { id: delivery!.reminderId, userId: delivery!.userId }, transaction });
            } else {
                await ReminderConfig.update({ timestamp: nextTimestamp, lastTriggeredAt: triggeredAt }, {
                    where: { id: delivery!.reminderId, userId: delivery!.userId }, transaction,
                });
            }
        });
    }

    async getDelivery(id: string, userId: string): Promise<ReminderDelivery | null> {
        return ReminderDelivery.findOne({ where: { id, userId, status: { [Op.in]: ['delivered', 'sending', 'uncertain'] }, expiresAt: { [Op.gt]: this.now() } } });
    }

    async recoverDelivery(id: string, userId: string, messageId: string, channelId: string): Promise<ReminderDelivery | null> {
        return this.transaction(async transaction => {
            await ReminderDelivery.update({ status: 'delivered', messageId, channelId }, { where: {
                id, userId, status: { [Op.in]: ['sending', 'uncertain'] }, messageId: null, channelId: null,
                expiresAt: { [Op.gt]: this.now() },
            }, transaction });
            return ReminderDelivery.findOne({ where: { id, userId, status: 'delivered', expiresAt: { [Op.gt]: this.now() } }, transaction });
        });
    }

    async snoozeDelivery(
        id: string, userId: string, timestamp: number, timespan: string, messageId: string, channelId: string,
    ): Promise<boolean> {
        if (!this.validTime(timestamp, timespan)) return false;
        return this.transaction(async transaction => {
            const where = this.deliveryWhere(id, userId, messageId, channelId);
            const [changed] = await ReminderDelivery.update({ status: 'snoozed' }, { where, transaction });
            if (changed !== 1) return false;
            const delivery = await ReminderDelivery.findByPk(id, { transaction });
            // A follow-up is independent of the recurring reminder's next occurrence.
            await ReminderConfig.create({ id: randomUUID(), userId, message: delivery!.message, timestamp, timespan, completed: false }, { transaction });
            return true;
        });
    }

    async dismissDelivery(id: string, userId: string, messageId: string, channelId: string): Promise<boolean> {
        return this.transaction(async transaction => {
            const [changed] = await ReminderDelivery.update({ status: 'dismissed' }, { where: this.deliveryWhere(id, userId, messageId, channelId), transaction });
            return changed === 1;
        });
    }

    async prune(): Promise<void> {
        await this.transaction(async transaction => {
            await ReminderDraft.destroy({ where: { expiresAt: { [Op.lte]: this.now() } }, transaction });
            // Outstanding occurrences keep their replay guard even after button expiry.
            await ReminderDelivery.destroy({ where: {
                expiresAt: { [Op.lte]: this.now() },
                [Op.or]: [{ finalized: true }, { reminderId: { [Op.notIn]: literal('(SELECT "id" FROM "ReminderConfigs")') } }],
            }, transaction });
        });
    }

    private deliveryWhere(id: string, userId: string, messageId: string, channelId: string) {
        return { id, userId, messageId, channelId, status: 'delivered', expiresAt: { [Op.gt]: this.now() } };
    }

    private validTime(timestamp: number, timespan: string): boolean {
        return Number.isSafeInteger(timestamp) && timestamp > this.now() && timestamp - this.now() <= 3660 * 86_400_000
            && timespan.length > 0 && timespan.length <= 100;
    }

    private async transaction<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
        return serializedTransaction(ReminderDraft.sequelize!, operation);
    }
}
