import { BaseManager } from './baseManager.js';
import { LeagueConfig } from '../models/league-config.js';
import { UserConfig } from '../models/user-config.js';
import type { CreationAttributes } from 'sequelize';
import { formatRiotId, parseRiotId } from '../utils/riotId.js';

export interface LinkedRiotAccountUpdate {
    discordId: string;
    summonerName: string;
    riotIdGameName?: string | null;
    riotIdTagLine?: string | null;
    region: string;
    puuid: string;
}

function normalizeOptional(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function normalizeLinkedRiotAccount(account: LinkedRiotAccountUpdate): LinkedRiotAccountUpdate {
    const parsed = parseRiotId(account.summonerName);
    const riotIdGameName = normalizeOptional(account.riotIdGameName) ?? parsed?.gameName ?? null;
    const riotIdTagLine = normalizeOptional(account.riotIdTagLine) ?? parsed?.tagLine ?? null;
    const summonerName = formatRiotId(riotIdGameName, riotIdTagLine, account.summonerName);

    return {
        discordId: account.discordId,
        summonerName,
        riotIdGameName,
        riotIdTagLine,
        region: account.region,
        puuid: account.puuid,
    };
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
        const normalized = normalizeLinkedRiotAccount(account);

        await UserConfig.findOrCreate({
            where: { discordId: normalized.discordId },
            defaults: { discordId: normalized.discordId },
        });

        const existing = await this.getLinkedAccount(normalized.discordId);
        if (existing) {
            await existing.update(normalized);
            return existing;
        }

        const payload: CreationAttributes<LeagueConfig> = {
            discordId: normalized.discordId,
            summonerName: normalized.summonerName,
            riotIdGameName: normalized.riotIdGameName,
            riotIdTagLine: normalized.riotIdTagLine,
            region: normalized.region,
            puuid: normalized.puuid,
        } as CreationAttributes<LeagueConfig>;

        return LeagueConfig.create(payload);
    }

    async removeLinkedAccount(discordId: string): Promise<number> {
        return this.remove({ discordId });
    }
}
