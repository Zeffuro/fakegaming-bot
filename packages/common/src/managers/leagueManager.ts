import { BaseManager } from './baseManager.js';
import { LeagueConfig } from '../models/league-config.js';
import { UserConfig } from '../models/user-config.js';
import type { CreationAttributes } from 'sequelize';

export interface LinkedRiotAccountUpdate {
    discordId: string;
    summonerName: string;
    region: string;
    puuid: string;
}

export class LeagueManager extends BaseManager<LeagueConfig> {
    constructor() {
        super(LeagueConfig);
    }

    async getLinkedAccounts(): Promise<LeagueConfig[]> {
        return LeagueConfig.findAll({
            order: [['updatedAt', 'DESC'], ['discordId', 'ASC']],
        });
    }

    async getLinkedAccountsPlain() {
        const rows = await this.getLinkedAccounts();
        return rows.map(row => row.get({ plain: true }));
    }

    async getLinkedAccount(discordId: string): Promise<LeagueConfig | null> {
        return LeagueConfig.findOne({ where: { discordId } });
    }

    async getLinkedAccountPlain(discordId: string) {
        const row = await this.getLinkedAccount(discordId);
        return row?.get({ plain: true }) ?? null;
    }

    async setLinkedAccount(account: LinkedRiotAccountUpdate): Promise<LeagueConfig> {
        await UserConfig.findOrCreate({
            where: { discordId: account.discordId },
            defaults: { discordId: account.discordId },
        });

        const existing = await this.getLinkedAccount(account.discordId);
        if (existing) {
            await existing.update(account);
            return existing;
        }

        const payload: CreationAttributes<LeagueConfig> = {
            discordId: account.discordId,
            summonerName: account.summonerName,
            region: account.region,
            puuid: account.puuid,
        } as CreationAttributes<LeagueConfig>;

        return LeagueConfig.create(payload);
    }

    async removeLinkedAccount(discordId: string): Promise<number> {
        return this.remove({ discordId });
    }
}
