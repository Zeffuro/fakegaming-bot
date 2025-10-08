import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { ServerConfig } from '../server-config.js';

describe('ServerConfig Model', () => {
  beforeEach(async () => {
    await configManager.serverManager.removeAll();
  });

  it('should create a server config with required fields', async () => {
    const server = await ServerConfig.create({
      serverId: 'server-123',
      prefix: '!',
    });

    expect(server.serverId).toBe('server-123');
    expect(server.prefix).toBe('!');
    expect(server.welcomeMessage).toBeUndefined();
  });

  it('should create a server config with welcome message', async () => {
    const server = await ServerConfig.create({
      serverId: 'server-456',
      prefix: '?',
      welcomeMessage: 'Welcome to our server!',
    });

    expect(server.welcomeMessage).toBe('Welcome to our server!');
  });

  it('should update server prefix', async () => {
    const server = await ServerConfig.create({
      serverId: 'server-update',
      prefix: '!',
    });

    server.prefix = '$';
    await server.save();

    const updated = await ServerConfig.findByPk('server-update');
    expect(updated?.prefix).toBe('$');
  });

  it('should update welcome message', async () => {
    const server = await ServerConfig.create({
      serverId: 'server-welcome',
      prefix: '!',
      welcomeMessage: 'Old welcome',
    });

    server.welcomeMessage = 'New welcome message';
    await server.save();

    const updated = await ServerConfig.findByPk('server-welcome');
    expect(updated?.welcomeMessage).toBe('New welcome message');
  });

  it('should delete a server config', async () => {
    const server = await ServerConfig.create({
      serverId: 'server-delete',
      prefix: '!',
    });

    await server.destroy();

    const deleted = await ServerConfig.findByPk('server-delete');
    expect(deleted).toBeNull();
  });

  it('should enforce unique serverId', async () => {
    await ServerConfig.create({
      serverId: 'unique-server',
      prefix: '!',
    });

    await expect(
      ServerConfig.create({
        serverId: 'unique-server',
        prefix: '?',
      })
    ).rejects.toThrow();
  });
});

