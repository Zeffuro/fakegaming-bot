import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefreshSessionRecord } from '../refreshSessions';

const storedValues = new Map<string, unknown>();
const storedTtls = new Map<string, number>();

const mockCacheGet = vi.fn(async <T>(key: string): Promise<T | null> => {
    return storedValues.has(key) ? storedValues.get(key) as T : null;
});

const mockCacheSet = vi.fn(async <T>(key: string, value: T, ttlMs: number): Promise<void> => {
    storedValues.set(key, value);
    storedTtls.set(key, ttlMs);
});

const mockCacheDel = vi.fn(async (key: string): Promise<void> => {
    storedValues.delete(key);
    storedTtls.delete(key);
});

vi.mock('@zeffuro/fakegaming-common', async (importOriginal: () => Promise<typeof import('@zeffuro/fakegaming-common')>) => {
    const actual = await importOriginal();
    return {
        ...actual,
        cacheGet: mockCacheGet,
        cacheSet: mockCacheSet,
        cacheDel: mockCacheDel,
    };
});

const {
    createRefreshSession,
    getRefreshSession,
    rotateRefreshSession,
    updateRefreshSession,
    revokeRefreshSession
} = await import('../refreshSessions');

describe('refreshSessions', () => {
    beforeEach(() => {
        storedValues.clear();
        storedTtls.clear();
        vi.clearAllMocks();
    });

    it('creates a hashed refresh session record with idle ttl', async () => {
        const issued = await createRefreshSession({
            user: { id: '42', username: 'alice' },
            discordRefreshToken: 'discord-refresh',
            nowMs: 1000
        });

        expect(issued.token).toBeTruthy();
        expect(storedValues.size).toBe(1);
        const key = [...storedValues.keys()][0]!;
        expect(key).toMatch(/^dashboard:refresh-session:[a-f0-9]{64}$/);
        expect(key).not.toContain(issued.token);
        expect(storedTtls.get(key)).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('reads an existing non-expired session', async () => {
        const issued = await createRefreshSession({
            user: { id: '42' },
            nowMs: 1000
        });

        const record = await getRefreshSession(issued.token, 2000);
        expect(record?.user.id).toBe('42');
    });

    it('deletes and rejects an absolute-expired session', async () => {
        const issued = await createRefreshSession({
            user: { id: '42' },
            nowMs: 1000
        });
        const key = [...storedValues.keys()][0]!;
        const record = storedValues.get(key) as RefreshSessionRecord;
        storedValues.set(key, {
            ...record,
            absoluteExpiresAt: 1500
        });

        const result = await getRefreshSession(issued.token, 2000);
        expect(result).toBeNull();
        expect(mockCacheDel).toHaveBeenCalledWith(key);
    });

    it('rotates a session token and removes the old key', async () => {
        const issued = await createRefreshSession({
            user: { id: '42' },
            nowMs: 1000
        });
        const oldKey = [...storedValues.keys()][0]!;

        const rotated = await rotateRefreshSession(issued.token, 2000);

        expect(rotated?.token).toBeTruthy();
        expect(rotated?.token).not.toBe(issued.token);
        expect(storedValues.has(oldKey)).toBe(false);
        expect(storedValues.size).toBe(1);
        expect(rotated?.record.updatedAt).toBe(2000);
    });

    it('updates the Discord refresh token on the current session', async () => {
        const issued = await createRefreshSession({
            user: { id: '42' },
            discordRefreshToken: 'old',
            nowMs: 1000
        });

        const updated = await updateRefreshSession(issued.token, {
            discordRefreshToken: 'new'
        }, 2000);
        const record = await getRefreshSession(issued.token, 3000);

        expect(updated).toBe(true);
        expect(record?.discordRefreshToken).toBe('new');
        expect(record?.updatedAt).toBe(2000);
    });

    it('revokes the current session', async () => {
        const issued = await createRefreshSession({
            user: { id: '42' },
            nowMs: 1000
        });

        await revokeRefreshSession(issued.token);
        expect(storedValues.size).toBe(0);
    });
});

