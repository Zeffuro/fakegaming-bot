import { randomUUID } from 'node:crypto';
import type { CreationAttributes } from 'sequelize';
import { Op } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { UserDigestSubscriptionConfig } from '../models/user-digest-subscription-config.js';
import {
    computeNextDigestRunAt,
    serializeDigestCategories,
    type DigestCategory,
    type DigestFrequency,
} from '../utils/digestSchedule.js';

export interface UserDigestSubscriptionInput {
    discordId: string;
    frequency: DigestFrequency;
    timezone: string;
    runAt: string;
    dayOfWeek?: number | null;
    categories?: DigestCategory[];
    paused?: boolean;
    nextRunAt?: number;
}

export interface UserDigestRunUpdateInput {
    lastRunAt: number;
    lastSentAt?: number | null;
    nextRunAt: number;
}

export type UserDigestSubscriptionRecord = CreationAttributes<UserDigestSubscriptionConfig>;

export class UserDigestSubscriptionManager extends BaseManager<UserDigestSubscriptionConfig> {
    constructor() {
        super(UserDigestSubscriptionConfig);
    }

    async getForUser(discordId: string): Promise<UserDigestSubscriptionRecord | null> {
        return this.getOnePlain({ discordId });
    }

    async listDue(nowMs: number): Promise<UserDigestSubscriptionRecord[]> {
        return this.model.findAll({
            where: {
                paused: false,
                nextRunAt: { [Op.lte]: nowMs },
            },
            order: [['nextRunAt', 'ASC']],
            raw: true,
        }) as unknown as UserDigestSubscriptionRecord[];
    }

    async upsertForUser(input: UserDigestSubscriptionInput): Promise<UserDigestSubscriptionRecord> {
        const existing = await this.getForUser(input.discordId);
        const nextRunAt = input.nextRunAt ?? computeNextDigestRunAt({
            frequency: input.frequency,
            timezone: input.timezone,
            runAt: input.runAt,
            dayOfWeek: input.dayOfWeek,
        });
        if (nextRunAt === null) {
            throw new Error('Invalid digest schedule');
        }

        const payload = {
            frequency: input.frequency,
            timezone: input.timezone,
            runAt: input.runAt,
            dayOfWeek: input.frequency === 'weekly' ? input.dayOfWeek ?? 1 : null,
            categories: serializeDigestCategories(input.categories),
            paused: input.paused ?? false,
            nextRunAt,
        } as CreationAttributes<UserDigestSubscriptionConfig>;

        if (existing) {
            await this.updatePlain(payload, { discordId: input.discordId });
            const updated = await this.getForUser(input.discordId);
            if (!updated) throw new Error('Digest subscription update failed');
            return updated;
        }

        return this.addPlain({
            id: randomUUID(),
            discordId: input.discordId,
            ...payload,
            lastRunAt: null,
            lastSentAt: null,
        } as CreationAttributes<UserDigestSubscriptionConfig>);
    }

    async updatePausedForUser(discordId: string, paused: boolean, nextRunAt?: number): Promise<UserDigestSubscriptionRecord | null> {
        const existing = await this.getForUser(discordId);
        if (!existing) return null;

        await this.updatePlain({
            paused,
            ...(nextRunAt !== undefined ? { nextRunAt } : {}),
        } as CreationAttributes<UserDigestSubscriptionConfig>, { discordId });
        return this.getForUser(discordId);
    }

    async markRun(id: string, input: UserDigestRunUpdateInput): Promise<void> {
        await this.updatePlain({
            lastRunAt: input.lastRunAt,
            ...(input.lastSentAt !== undefined ? { lastSentAt: input.lastSentAt } : {}),
            nextRunAt: input.nextRunAt,
        } as CreationAttributes<UserDigestSubscriptionConfig>, { id });
    }

    async scheduleRetry(id: string, nextRunAt: number): Promise<void> {
        await this.updatePlain({
            nextRunAt,
        } as CreationAttributes<UserDigestSubscriptionConfig>, { id });
    }
}
