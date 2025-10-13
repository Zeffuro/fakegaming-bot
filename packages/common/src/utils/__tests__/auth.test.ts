import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We will import getJwt after setting globals per test to ensure env captured

const originalEnv = { ...process.env };
const g: any = globalThis as any;

function setupLocalStorage(initial: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(initial));
    g.window = {};
    g.localStorage = {
        getItem: vi.fn((k: string) => store.get(k) ?? null),
        setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
        removeItem: vi.fn((k: string) => void store.delete(k)),
        clear: vi.fn(() => store.clear()),
    };
    return { store };
}

function setupFetchOk(token: string) {
    g.fetch = vi.fn(async (_url: string, _init?: RequestInit) => ({
        ok: true,
        json: async () => ({ token }),
    } as Response));
}

function setupFetchNotOk() {
    g.fetch = vi.fn(async () => ({ ok: false } as Response));
}

describe('utils/auth.getJwt', () => {
    beforeEach(() => {
        process.env = { ...originalEnv, NEXT_PUBLIC_API_URL: 'http://api.local:3001', NEXT_PUBLIC_DASHBOARD_CLIENT_ID: 'dash', NEXT_PUBLIC_DASHBOARD_CLIENT_SECRET: 'secret' };
    });

    afterEach(() => {
        vi.resetModules();
        delete g.window;
        delete g.localStorage;
        delete g.fetch;
        process.env = originalEnv;
    });

    it('returns token from localStorage if present and does not call fetch', async () => {
        setupLocalStorage({ jwt: 'cached-token' });
        const fetchSpy = vi.spyOn(globalThis as any, 'fetch');
        const { getJwt } = await import('../auth.js');
        const token = await getJwt();
        expect(token).toBe('cached-token');
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('fetches token when not cached and stores it', async () => {
        const { store } = setupLocalStorage();
        setupFetchOk('fresh-token');
        const { getJwt } = await import('../auth.js');
        const token = await getJwt();
        expect(token).toBe('fresh-token');
        expect(store.get('jwt')).toBe('fresh-token');
        expect(g.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null when fetch fails', async () => {
        setupLocalStorage();
        setupFetchNotOk();
        const { getJwt } = await import('../auth.js');
        const token = await getJwt();
        expect(token).toBeNull();
    });
});
