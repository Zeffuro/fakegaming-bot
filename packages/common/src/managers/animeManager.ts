import { type CreationAttributes } from 'sequelize';
import { BaseManager } from './baseManager.js';
import { AnimeTitle } from '../models/anime-title.js';
import { AnimeSubscriptionConfig } from '../models/anime-subscription-config.js';
import { AnimeEpisode } from '../models/anime-episode.js';

export interface AnimeTitleInput {
    anilistId: number;
    titleRomaji?: string | null;
    titleEnglish?: string | null;
    titleNative?: string | null;
    description?: string | null;
    siteUrl?: string | null;
    coverImageUrl?: string | null;
    bannerImageUrl?: string | null;
    format?: string | null;
    status?: string | null;
    season?: string | null;
    seasonYear?: number | null;
    episodes?: number | null;
    duration?: number | null;
    averageScore?: number | null;
    genres?: string[];
    nextEpisode?: number | null;
    nextAiringAt?: number | null;
}

export class AnimeTitleManager extends BaseManager<AnimeTitle> {
    constructor() {
        super(AnimeTitle);
    }

    async upsertTitle(input: AnimeTitleInput): Promise<void> {
        await this.upsert({
            ...input,
            genresJson: JSON.stringify(input.genres ?? []),
        } as CreationAttributes<AnimeTitle>, ['anilistId']);
    }

    parseGenres(title: Pick<AnimeTitle, 'genresJson'> | CreationAttributes<AnimeTitle>): string[] {
        const raw = title.genresJson;
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        } catch {
            return [];
        }
    }
}

export class AnimeSubscriptionManager extends BaseManager<AnimeSubscriptionConfig> {
    constructor() {
        super(AnimeSubscriptionConfig);
    }

    async subscribeUser(args: { anilistId: number; userId: string; reminderMinutes?: number }): Promise<boolean> {
        const where = { anilistId: args.anilistId, targetType: 'dm', userId: args.userId };
        const existing = await this.getOnePlain(where);
        if (existing) {
            await this.updatePlain({
                ...existing,
                reminderMinutes: args.reminderMinutes ?? existing.reminderMinutes ?? 30,
            } as CreationAttributes<AnimeSubscriptionConfig>, { id: existing.id });
            return false;
        }
        await this.addPlain({
            anilistId: args.anilistId,
            targetType: 'dm',
            userId: args.userId,
            guildId: null,
            channelId: null,
            reminderMinutes: args.reminderMinutes ?? 30,
            lastNotifiedEpisode: null,
            lastNotifiedAiringAt: null,
        } as CreationAttributes<AnimeSubscriptionConfig>);
        return true;
    }

    async subscribeChannel(args: { anilistId: number; guildId: string; channelId: string; reminderMinutes?: number }): Promise<boolean> {
        const where = {
            anilistId: args.anilistId,
            targetType: 'channel',
            guildId: args.guildId,
            channelId: args.channelId,
        };
        const existing = await this.getOnePlain(where);
        if (existing) {
            await this.updatePlain({
                ...existing,
                reminderMinutes: args.reminderMinutes ?? existing.reminderMinutes ?? 30,
            } as CreationAttributes<AnimeSubscriptionConfig>, { id: existing.id });
            return false;
        }
        await this.addPlain({
            anilistId: args.anilistId,
            targetType: 'channel',
            userId: null,
            guildId: args.guildId,
            channelId: args.channelId,
            reminderMinutes: args.reminderMinutes ?? 30,
            lastNotifiedEpisode: null,
            lastNotifiedAiringAt: null,
        } as CreationAttributes<AnimeSubscriptionConfig>);
        return true;
    }

    async getUserSubscriptions(userId: string): Promise<CreationAttributes<AnimeSubscriptionConfig>[]> {
        return this.getManyPlain({ targetType: 'dm', userId });
    }

    async getGuildChannelSubscriptions(guildId: string): Promise<CreationAttributes<AnimeSubscriptionConfig>[]> {
        return this.getManyPlain({ targetType: 'channel', guildId });
    }

    async unsubscribeUser(args: { anilistId: number; userId: string }): Promise<number> {
        return this.remove({ anilistId: args.anilistId, targetType: 'dm', userId: args.userId });
    }

    async unsubscribeChannel(args: { anilistId: number; guildId: string; channelId: string }): Promise<number> {
        return this.remove({
            anilistId: args.anilistId,
            targetType: 'channel',
            guildId: args.guildId,
            channelId: args.channelId,
        });
    }
}

export class AnimeEpisodeManager extends BaseManager<AnimeEpisode> {
    constructor() {
        super(AnimeEpisode);
    }

    async upsertEpisode(args: { anilistId: number; episode: number; airingAt: number }): Promise<void> {
        await this.upsert(args as CreationAttributes<AnimeEpisode>, ['anilistId', 'episode']);
    }
}

export class AnimeManager {
    titles = new AnimeTitleManager();
    subscriptions = new AnimeSubscriptionManager();
    episodes = new AnimeEpisodeManager();
}
