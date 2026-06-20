import { beforeEach, describe, expect, it } from 'vitest';
import { LeagueConfig } from '../../models/league-config.js';
import { UserConfig } from '../../models/user-config.js';
import { configManager } from '../../vitest.setup.js';

describe('LeagueManager', () => {
    const leagueManager = configManager.leagueManager;

    beforeEach(async () => {
        await LeagueConfig.destroy({ where: {} });
        await UserConfig.destroy({ where: {} });
    });

    it('creates a user row when linking a Riot account', async () => {
        const linked = await leagueManager.setLinkedAccount({
            discordId: 'discord-1',
            summonerName: 'FirstSummoner',
            region: 'EUW',
            puuid: 'puuid-1',
        });

        const user = await UserConfig.findByPk('discord-1');
        const plain = await leagueManager.getLinkedAccountPlain('discord-1');

        expect(linked.discordId).toBe('discord-1');
        expect(user).not.toBeNull();
        expect(plain).toMatchObject({
            discordId: 'discord-1',
            summonerName: 'FirstSummoner',
            region: 'EUW',
            puuid: 'puuid-1',
        });
    });

    it('updates an existing linked Riot account', async () => {
        await leagueManager.setLinkedAccount({
            discordId: 'discord-2',
            summonerName: 'OldSummoner',
            region: 'NA',
            puuid: 'old-puuid',
        });

        const updated = await leagueManager.setLinkedAccount({
            discordId: 'discord-2',
            summonerName: 'NewSummoner',
            region: 'NA',
            puuid: 'new-puuid',
        });
        const linked = await leagueManager.getLinkedAccount('discord-2');

        expect(updated.discordId).toBe('discord-2');
        expect(linked?.summonerName).toBe('NewSummoner');
        expect(linked?.puuid).toBe('new-puuid');
    });

    it('lists and removes linked Riot accounts', async () => {
        await leagueManager.setLinkedAccount({
            discordId: 'discord-3',
            summonerName: 'ThirdSummoner',
            region: 'KR',
            puuid: 'puuid-3',
        });

        const linkedAccounts = await leagueManager.getLinkedAccountsPlain();
        const removed = await leagueManager.removeLinkedAccount('discord-3');
        const missing = await leagueManager.getLinkedAccountPlain('discord-3');

        expect(linkedAccounts).toHaveLength(1);
        expect(linkedAccounts[0].summonerName).toBe('ThirdSummoner');
        expect(removed).toBe(1);
        expect(missing).toBeNull();
    });
});
