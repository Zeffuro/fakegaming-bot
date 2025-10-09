import { describe, it, expect, beforeEach } from 'vitest';
import { configManager } from '../../vitest.setup.js';
import { ServerConfig } from '../../models/server-config.js';

describe('ServerManager', () => {
    const serverManager = configManager.serverManager;

    beforeEach(async () => {
        await serverManager.removeAll();
    });

    describe('getServer', () => {
        it('should return server by serverId', async () => {
            await ServerConfig.create({
                serverId: 'server-1',
                prefix: '!',
            });

            const result = await serverManager.getServer('server-1');

            expect(result).not.toBeNull();
            expect(result?.serverId).toBe('server-1');
            expect(result?.prefix).toBe('!');
        });

        it('should return null if server not found', async () => {
            const result = await serverManager.getServer('nonexistent');
            expect(result).toBeNull();
        });
    });
});
