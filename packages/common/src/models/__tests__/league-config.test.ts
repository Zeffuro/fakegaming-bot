import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { LeagueConfig } from '../league-config.js';
import { UserConfig } from '../user-config.js';

describe('LeagueConfig Model', () => {
  beforeEach(async () => {
    await configManager.userManager.remove({});
  });

  it('should create a league config linked to a user', async () => {
    // Create user first
    await UserConfig.create({
      discordId: 'discord-123',
    });

    const league = await LeagueConfig.create({
      discordId: 'discord-123',
      summonerName: 'TestSummoner',
      region: 'na1',
      puuid: 'test-puuid-123',
    });

    expect(league.discordId).toBe('discord-123');
    expect(league.summonerName).toBe('TestSummoner');
    expect(league.region).toBe('na1');
    expect(league.puuid).toBe('test-puuid-123');
  });

  it('should cascade delete when user is deleted', async () => {
    const user = await UserConfig.create({
      discordId: 'discord-cascade',
    });

    await LeagueConfig.create({
      discordId: 'discord-cascade',
      summonerName: 'CascadeTest',
      region: 'euw1',
      puuid: 'cascade-puuid',
    });

    await user.destroy();

    const league = await LeagueConfig.findOne({
      where: { discordId: 'discord-cascade' },
    });

    expect(league).toBeNull();
  });

  it('should update league information', async () => {
    await UserConfig.create({
      discordId: 'discord-update',
    });

    const league = await LeagueConfig.create({
      discordId: 'discord-update',
      summonerName: 'OldName',
      region: 'na1',
      puuid: 'old-puuid',
    });

    league.summonerName = 'NewName';
    league.puuid = 'new-puuid';
    await league.save();

    const updated = await LeagueConfig.findOne({
      where: { discordId: 'discord-update' },
    });

    expect(updated?.summonerName).toBe('NewName');
    expect(updated?.puuid).toBe('new-puuid');
  });

  it('should find league config by discordId', async () => {
    await UserConfig.create({
      discordId: 'discord-find',
    });

    await LeagueConfig.create({
      discordId: 'discord-find',
      summonerName: 'FindMe',
      region: 'kr',
      puuid: 'find-puuid',
    });

    const league = await LeagueConfig.findOne({
      where: { discordId: 'discord-find' },
    });

    expect(league).not.toBeNull();
    expect(league?.summonerName).toBe('FindMe');
  });

  it('should include user when querying with associations', async () => {
    await UserConfig.create({
      discordId: 'discord-assoc',
      nickname: 'TestNick',
    });

    await LeagueConfig.create({
      discordId: 'discord-assoc',
      summonerName: 'AssocTest',
      region: 'euw1',
      puuid: 'assoc-puuid',
    });

    const league = await LeagueConfig.findOne({
      where: { discordId: 'discord-assoc' },
      include: [UserConfig],
    });

    expect(league?.user).toBeDefined();
    expect(league?.user.nickname).toBe('TestNick');
  });
});

