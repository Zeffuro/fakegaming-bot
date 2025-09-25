import {BaseManager} from './baseManager.js';
import {QuoteConfig} from '../models/quote-config.js';
import {Op} from 'sequelize';

/**
 * Manages quote records for guilds and authors.
 */
export class QuoteManager extends BaseManager<QuoteConfig> {
    constructor() {
        super(QuoteConfig);
    }

    async getQuotesByGuild({guildId}: { guildId: string }): Promise<QuoteConfig[]> {
        return (await this.model.findAll({where: {guildId}})).map(q => q.get());
    }

    async getQuotesByAuthor({guildId, authorId}: { guildId: string, authorId: string }): Promise<QuoteConfig[]> {
        return (await this.model.findAll({where: {guildId, authorId}})).map(q => q.get());
    }

    async searchQuotes({guildId, text}: { guildId: string, text: string }): Promise<QuoteConfig[]> {
        return (await this.model.findAll({
            where: {
                guildId,
                quote: {
                    [Op.like]: `%${text}%`
                }
            }
        })).map(q => q.get({plain: true}) as QuoteConfig);
    }
}