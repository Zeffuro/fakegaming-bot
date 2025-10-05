import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { DisabledCommandConfig } from '../disabled-command-config.js';

describe('DisabledCommandConfig Model', () => {
  beforeEach(async () => {
    await configManager.disabledCommandManager.remove({});
  });

  it('should create a disabled command entry', async () => {
    const disabled = await DisabledCommandConfig.create({
      guildId: 'guild-123',
      commandName: 'poll',
    });

    expect(disabled.guildId).toBe('guild-123');
    expect(disabled.commandName).toBe('poll');
    expect(disabled.id).toBeTypeOf('number');
  });

  it('should find disabled commands by guildId', async () => {
    await DisabledCommandConfig.create({
      guildId: 'test-guild',
      commandName: 'poll',
    });

    await DisabledCommandConfig.create({
      guildId: 'test-guild',
      commandName: 'roll',
    });

    const disabled = await DisabledCommandConfig.findAll({
      where: { guildId: 'test-guild' },
    });

    expect(disabled).toHaveLength(2);
    expect(disabled.map(d => d.commandName)).toContain('poll');
    expect(disabled.map(d => d.commandName)).toContain('roll');
  });

  it('should find specific disabled command', async () => {
    await DisabledCommandConfig.create({
      guildId: 'guild-specific',
      commandName: 'spin',
    });

    const disabled = await DisabledCommandConfig.findOne({
      where: {
        guildId: 'guild-specific',
        commandName: 'spin',
      },
    });

    expect(disabled).not.toBeNull();
    expect(disabled?.commandName).toBe('spin');
  });

  it('should allow same command disabled in different guilds', async () => {
    await DisabledCommandConfig.create({
      guildId: 'guild-1',
      commandName: 'poll',
    });

    const disabled = await DisabledCommandConfig.create({
      guildId: 'guild-2',
      commandName: 'poll',
    });

    expect(disabled).not.toBeNull();
  });

  it('should delete a disabled command entry', async () => {
    const disabled = await DisabledCommandConfig.create({
      guildId: 'guild-delete',
      commandName: 'weather',
    });

    const id = disabled.id;
    await disabled.destroy();

    const deleted = await DisabledCommandConfig.findByPk(id);
    expect(deleted).toBeNull();
  });

  it('should allow multiple commands to be disabled in same guild', async () => {
    await DisabledCommandConfig.create({
      guildId: 'guild-multi',
      commandName: 'poll',
    });

    await DisabledCommandConfig.create({
      guildId: 'guild-multi',
      commandName: 'roll',
    });

    await DisabledCommandConfig.create({
      guildId: 'guild-multi',
      commandName: 'spin',
    });

    const disabled = await DisabledCommandConfig.findAll({
      where: { guildId: 'guild-multi' },
    });

    expect(disabled).toHaveLength(3);
  });
});

