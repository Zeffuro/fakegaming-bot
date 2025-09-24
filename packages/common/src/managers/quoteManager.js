import { BaseManager } from './baseManager.js';
import { QuoteConfig } from '../models/quote-config.js';
import { Op } from 'sequelize';
/**
 * Manages quote records for guilds and authors.
 */
export class QuoteManager extends BaseManager {
    constructor() {
        super(QuoteConfig);
    }
    async getQuotes({ guildId }) {
        return await this.model.findAll({ where: { guildId } });
    }
    async getQuotesByAuthor({ guildId, authorId }) {
        return await this.model.findAll({ where: { guildId, authorId } });
    }
    async searchQuotes({ guildId, text }) {
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
