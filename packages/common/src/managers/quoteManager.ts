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

    async getQuotes({guildId}: { guildId: string }): Promise<QuoteConfig[]> {
        return await this.model.findAll({where: {guildId}});
    }

    async getQuotesByAuthor({guildId, authorId}: { guildId: string, authorId: string }): Promise<QuoteConfig[]> {
        return await this.model.findAll({where: {guildId, authorId}});
    }

    async searchQuotes({guildId, text}: { guildId: string, text: string }): Promise<QuoteConfig[]> {
        return await this.model.findAll({
            where: {
                guildId,
                quote: {
                    [Op.like]: `%${text}%`
                }
            }
        });
    }
}