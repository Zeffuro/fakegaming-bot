import type { CreationAttributes } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { SteamNewsSubscriptionConfig } from '../models/steam-news-subscription-config.js';

export class SteamNewsSubscriptionManager extends BaseManager<SteamNewsSubscriptionConfig> {
    constructor() {
        super(SteamNewsSubscriptionConfig);
    }

    async getActiveSubscriptions(): Promise<CreationAttributes<SteamNewsSubscriptionConfig>[]> {
        return this.getMany({ paused: false }, { raw: true });
    }

    async setPaused(id: number, paused: boolean): Promise<void> {
        await this.update({ paused } as Partial<SteamNewsSubscriptionConfig> as never, { id } as never);
    }

    async upsertSubscription(
        subscription: Partial<SteamNewsSubscriptionConfig> | SteamNewsSubscriptionConfig
    ): Promise<void> {
        const data = subscription instanceof SteamNewsSubscriptionConfig
            ? subscription.get({ plain: true })
            : subscription;
        await this.upsert(data, ['guildId', 'steamAppId', 'discordChannelId']);
    }
}
