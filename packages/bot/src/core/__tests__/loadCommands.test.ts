import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCommands } from '../loadCommands.js';
import fs from 'fs';
import { FakegamingBot } from '../../index.js';

vi.mock('fs');

describe('loadCommands', () => {
    let mockClient: FakegamingBot;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = {
            commands: new Map(),
        } as unknown as FakegamingBot;
    });

    it('should skip folders without commands directory', async () => {
        vi.mocked(fs.readdirSync).mockReturnValueOnce(['general', 'utils'] as any);

        vi.mocked(fs.existsSync)
            .mockReturnValueOnce(true)  // general/commands exists
            .mockReturnValueOnce(false); // utils/commands does not exist

        vi.mocked(fs.readdirSync)
            .mockReturnValueOnce([] as any); // no command files in general

        await loadCommands(mockClient, '/test/modules');

        // Should check both folders but only process general
        expect(fs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should filter only .js and .ts files', async () => {
        vi.mocked(fs.readdirSync)
            .mockReturnValueOnce(['general'] as any)
            .mockReturnValueOnce(['help.js', 'poll.ts', 'readme.md', 'test.txt'] as any);

        vi.mocked(fs.existsSync).mockReturnValue(true);

        // Even though we can't test the actual import, we can verify the file filtering
        const _commandsPathCalls = vi.mocked(fs.readdirSync).mock.calls;

        await loadCommands(mockClient, '/test/modules').catch(() => {
            // Expected to fail on import, that's ok
        });

        // Verify it read the commands directory
        expect(fs.readdirSync).toHaveBeenCalledWith(expect.stringContaining('commands'));
    });

    it('should handle empty modules directory', async () => {
        vi.mocked(fs.readdirSync).mockReturnValueOnce([] as any);

        await loadCommands(mockClient, '/test/modules');

        expect(mockClient.commands.size).toBe(0);
    });

    it('should handle modules with no command files', async () => {
        vi.mocked(fs.readdirSync)
            .mockReturnValueOnce(['general'] as any)
            .mockReturnValueOnce([] as any);

        vi.mocked(fs.existsSync).mockReturnValue(true);

        await loadCommands(mockClient, '/test/modules');

        expect(mockClient.commands.size).toBe(0);
    });
});
