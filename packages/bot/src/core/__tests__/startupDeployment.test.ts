import { describe, expect, it, vi } from 'vitest';
import { deployCommandsAtStartup } from '../startupDeployment.js';

function createLogger() {
    return {
        info: vi.fn(),
        error: vi.fn(),
    };
}

describe('deployCommandsAtStartup', () => {
    it('awaits and logs a successful deployment result', async () => {
        const deploy = vi.fn(async () => ({
            mode: 'auto' as const,
            scope: 'global' as const,
            targets: [{ action: 'checked' as const, hash: 'command-hash', key: 'global:client', target: 'global' as const }],
        }));
        const logger = createLogger();

        await deployCommandsAtStartup(deploy, logger);

        expect(deploy).toHaveBeenCalledOnce();
        expect(logger.info).toHaveBeenCalledWith({
            mode: 'auto',
            scope: 'global',
            targets: [{ action: 'checked', key: 'global:client', target: 'global' }],
        }, 'Slash command deployment check completed.');
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs deployment failures without preventing bot startup', async () => {
        const failure = new Error('Discord unavailable');
        const deploy = vi.fn(async () => {
            throw failure;
        });
        const logger = createLogger();

        await expect(deployCommandsAtStartup(deploy, logger)).resolves.toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith({ err: failure }, 'Failed to deploy slash commands:');
    });
});
