import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefreshSessionRecord } from '../refreshSessions';

const storedValues = new Map<string, string>();
const storedTtls = new Map<string, number>();

const get = vi.fn(async (key: string) => storedValues.get(key) ?? null);

const set = vi.fn(async (key: string, value: string, _px: string, ttlMs: number, nx?: string) => {
    if (nx && storedValues.has(key)) return null;
    storedValues.set(key, value);
    storedTtls.set(key, ttlMs);
    return 'OK';
});

const del = vi.fn(async (key: string) => {
    storedTtls.delete(key);
    return Number(storedValues.delete(key));
});

const evaluate = vi.fn(async (_script: string, keyCount: number, ...args: (string | number)[]) => {
    const key = String(args[0]);
    if (keyCount === 2) {
        const alias = String(args[1]);
        const raw = storedValues.get(key);
        const id = raw ? (JSON.parse(raw) as RefreshSessionRecord).sessionId ?? args[2] : storedValues.get(alias);
        const indexKey = `${args[3]}${id}`;
        const active = storedValues.get(indexKey);
        if (active) await del(active);
        await del(indexKey);
        await del(alias);
        return del(key);
    }
    const destination = keyCount === 4 ? String(args[1]) : key;
    if (storedValues.get(key) !== args[keyCount] || (keyCount === 4 && storedValues.has(destination))) return 0;
    storedValues.set(destination, String(args[keyCount + 1]));
    storedTtls.set(destination, Number(args[keyCount + 2]));
    if (keyCount === 4) {
        storedValues.set(String(args[2]), destination);
        storedValues.set(String(args[3]), String(args[7]));
        storedValues.delete(key);
        storedTtls.delete(key);
    }
    return 1;
});

vi.mock('@zeffuro/fakegaming-common', async (importOriginal: () => Promise<typeof import('@zeffuro/fakegaming-common')>) => {
    const actual = await importOriginal();
    return {
        ...actual,
        requireRedis: async () => ({ get, set, del, eval: evaluate }),
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
        expect([...storedValues.keys()].filter(key => key.includes(':refresh-session:'))).toHaveLength(1);
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
        const record = JSON.parse(storedValues.get(key)!) as RefreshSessionRecord;
        storedValues.set(key, JSON.stringify({
            ...record,
            absoluteExpiresAt: 1500
        }));

        const result = await getRefreshSession(issued.token, 2000);
        expect(result).toBeNull();
        expect(del).toHaveBeenCalledWith(key);
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
        expect([...storedValues.keys()].filter(key => key.includes(':refresh-session:'))).toHaveLength(1);
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

    it('can issue only one successor for simultaneous rotations', async () => {
        const issued = await createRefreshSession({ user: { id: '42' }, nowMs: 1000 });
        const results = await Promise.all([rotateRefreshSession(issued.token, 2000), rotateRefreshSession(issued.token, 2000)]);
        expect(results.filter(Boolean)).toHaveLength(1);
        expect([...storedValues.keys()].filter(key => key.includes(':refresh-session:'))).toHaveLength(1);
        expect(await getRefreshSession(issued.token, 2100)).toBeNull();
    });

    it('does not recreate a revoked session from a concurrent update', async () => {
        const issued = await createRefreshSession({ user: { id: '42' }, nowMs: 1000 });
        let resume!: () => void;
        let read!: () => void;
        const reading = new Promise<void>(resolve => { read = resolve; });
        get.mockImplementationOnce(async key => {
            const value = storedValues.get(key) ?? null;
            read();
            await new Promise<void>(resolve => { resume = resolve; });
            return value;
        });
        const updating = updateRefreshSession(issued.token, { discordRefreshToken: 'replacement' }, 2000);
        await reading;
        await revokeRefreshSession(issued.token);
        resume();
        await expect(updating).resolves.toBe(false);
        expect(storedValues.size).toBe(0);
    });

    it('reports storage failure without passing Redis command arguments to callers', async () => {
        set.mockRejectedValueOnce(new Error('Sensitive Redis arguments'));
        await expect(createRefreshSession({ user: { id: '42' }, nowMs: 1000 })).rejects.toThrow('Refresh session store unavailable');
        const issued = await createRefreshSession({ user: { id: '42' }, nowMs: 1000 });
        evaluate.mockRejectedValueOnce(new Error('Sensitive Redis arguments'));
        await expect(rotateRefreshSession(issued.token, 2000)).rejects.toThrow('Refresh session store unavailable');
        await expect(getRefreshSession(issued.token, 2100)).resolves.toEqual(issued.record);
    });

    it('saves a provider replacement token on the current session after browser rotation', async () => {
        const issued = await createRefreshSession({ user: { id: '42' }, discordRefreshToken: 'original', nowMs: 1000 });
        const observed = (await getRefreshSession(issued.token, 1100))!;
        const rotated = (await rotateRefreshSession(issued.token, 1200))!;
        await expect(updateRefreshSession(issued.token, { discordRefreshToken: 'replacement' }, 1300, observed)).resolves.toBe(true);
        await expect(getRefreshSession(issued.token, 1400)).resolves.toBeNull();
        await expect(getRefreshSession(rotated.token, 1500)).resolves.toMatchObject({ discordRefreshToken: 'replacement' });
        await expect(updateRefreshSession(issued.token, { discordRefreshToken: 'outdated' }, 1600, observed)).resolves.toBe(false);
        await revokeRefreshSession(rotated.token);
        await expect(updateRefreshSession(issued.token, { discordRefreshToken: 'outdated' }, 1700, observed)).resolves.toBe(false);
    });

    it('revokes the active session when a concurrent logout presents the just-rotated cookie', async () => {
        const issued = await createRefreshSession({ user: { id: '42' }, nowMs: 1000 });
        const rotated = (await rotateRefreshSession(issued.token, 1100))!;
        await expect(getRefreshSession(issued.token, 1200)).resolves.toBeNull();
        await revokeRefreshSession(issued.token);
        await expect(getRefreshSession(rotated.token, 1300)).resolves.toBeNull();
        await expect(rotateRefreshSession(rotated.token, 1400)).resolves.toBeNull();
    });
});

