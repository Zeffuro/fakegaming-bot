import { BaseManager } from './baseManager.js';
import { Notification } from '../models/notification.js';

export class NotificationsManager extends BaseManager<Notification> {
    constructor() {
        super(Notification);
    }

    async has(provider: string, eventId: string): Promise<boolean> {
        return this.exists({ provider, eventId });
    }

    /**
     * Check if a notification exists scoped to a specific guild.
     * Does not require a unique constraint; returns true only if a record with matching provider, eventId and guildId exists.
     */
    async hasForGuild(provider: string, eventId: string, guildId: string): Promise<boolean> {
        return this.exists({ provider, eventId, guildId } as any);
    }

    async recordIfNew(entry: {
        provider: string;
        eventId: string;
        guildId?: string;
        channelId?: string;
        messageId?: string;
    }): Promise<{ created: boolean; record: Notification }>
    {
        const [record, created] = await this.findOrCreate({
            where: { provider: entry.provider, eventId: entry.eventId },
            defaults: entry as any
        });
        return { created, record };
    }

    /**
     * Upsert message metadata by (provider,eventId).
     * If a notification exists, updates its messageId/channelId/guildId; otherwise creates it.
     */
    async setMessageMeta(provider: string, eventId: string, meta: { messageId?: string; guildId?: string; channelId?: string }): Promise<void> {
        const [count] = await this.updatePlain(meta as any, { provider, eventId } as any);
        if (count === 0) {
            await this.addPlain({ provider, eventId, ...meta } as any);
        }
    }
}
