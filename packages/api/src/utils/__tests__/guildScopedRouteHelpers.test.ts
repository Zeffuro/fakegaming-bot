import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '@zeffuro/fakegaming-common';
import { loadGuildScopedRecords, sendGuildScopedRecordById } from '../guildScopedRouteHelpers.js';

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

describe('sendGuildScopedRecordById', () => {
    it('uses the route-owned not-found message when a manager throws NotFoundError', async () => {
        const json = vi.fn();
        const status = vi.fn(() => ({ json }));

        await sendGuildScopedRecordById({} as never, { status } as never, 42, {
            findByPk: vi.fn(async () => { throw new NotFoundError('Internal manager message'); }),
            notFoundMessage: 'Localized route message',
        });

        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({
            error: { code: 'NOT_FOUND', message: 'Localized route message' },
        });
    });
});
