import { describe, expect, it, vi } from 'vitest';
import { loadGuildScopedRecords } from '../guildScopedRouteHelpers.js';

interface TestGuildRecord {
    id: number;
    guildId: string;
}

function createManager() {
    const allRecords: TestGuildRecord[] = [
        { id: 1, guildId: 'guild-1' },
        { id: 2, guildId: 'guild-2' },
    ];
    const guildRecords: TestGuildRecord[] = [
        { id: 1, guildId: 'guild-1' },
    ];

    return {
        allRecords,
        guildRecords,
        manager: {
            getAllPlain: vi.fn(async () => allRecords),
            getManyPlain: vi.fn(async (_where: { guildId: string }) => guildRecords),
        },
    };
}

describe('loadGuildScopedRecords', () => {
    it('loads all records when no guildId is supplied', async () => {
        const { allRecords, manager } = createManager();

        const result = await loadGuildScopedRecords(manager, undefined);

        expect(result).toBe(allRecords);
        expect(manager.getAllPlain).toHaveBeenCalledOnce();
        expect(manager.getManyPlain).not.toHaveBeenCalled();
    });

    it('loads records by guildId when supplied', async () => {
        const { guildRecords, manager } = createManager();

        const result = await loadGuildScopedRecords(manager, 'guild-1');

        expect(result).toBe(guildRecords);
        expect(manager.getAllPlain).not.toHaveBeenCalled();
        expect(manager.getManyPlain).toHaveBeenCalledWith({ guildId: 'guild-1' });
    });
});
