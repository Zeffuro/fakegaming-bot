import { BaseManager } from './baseManager.js';
import { QuoteConfig, type QuoteModerationStatus } from '../models/quote-config.js';
import { Op, type CreationAttributes } from 'sequelize';

export class QuoteManager extends BaseManager<QuoteConfig> {
    constructor() {
        super(QuoteConfig);
    }

    /** Get all quotes for a guild */
    async getQuotesByGuild(guildId: string) {
        return this.getMany({ guildId }, { raw: true });
    }

    /** Get all quotes by author in a guild */
    async getQuotesByAuthor(guildId: string, authorId: string) {
        return this.getMany({ guildId, authorId }, { raw: true });
    }

    /** Search quotes by text in a guild */
    async searchQuotes(guildId: string, text: string) {
        const pattern = `%${text}%`;
        return this.getMany({
            guildId,
            [Op.or]: [
                { quote: { [Op.like]: pattern } },
                { tags: { [Op.like]: pattern } },
                { source: { [Op.like]: pattern } },
                { context: { [Op.like]: pattern } },
            ],
        }, { raw: true });
    }

    /** Add a quote (upsert is optional here if you want unique IDs) */
    async addQuote(data: Partial<QuoteConfig>) {
        return this.add(data, { raw: true });
    }

    /** Add or update a quote by id */
    async upsertQuote(data: Partial<QuoteConfig> & { id: string }) {
        const created = await this.upsert(data);
        // fetch fresh record as plain object
        const record = await this.getOne({ id: data.id }, { raw: true });
        return { record, created };
    }

    async updateModerationStatus(id: string, moderationStatus: QuoteModerationStatus) {
        const existing = await this.getOnePlain({ id });
        if (!existing) return null;

        await this.updatePlain({ moderationStatus } as CreationAttributes<QuoteConfig>, { id });
        return this.getOnePlain({ id });
    }
}
