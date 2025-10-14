import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const OLD_ENV = { ...process.env };

async function importEnv() {
    vi.resetModules();
    return await import('@/lib/env');
}

describe('env constants', () => {
    beforeEach(() => {
        process.env = { ...OLD_ENV };
        delete process.env.NEXT_PUBLIC_PUBLIC_URL;
        delete process.env.PUBLIC_URL;
        delete process.env.DISCORD_REDIRECT_URI;
        // Ensure required JWT env vars are present by default for non-throwing tests
        process.env.JWT_SECRET = 'supersecret';
        process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
        delete process.env.API_URL;
        process.env.DISCORD_CLIENT_ID = 'cid';
        process.env.DISCORD_CLIENT_SECRET = 'csecret';
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
    });

    it('PUBLIC_URL prefers NEXT_PUBLIC_PUBLIC_URL and trims trailing slash', async () => {
        process.env.NEXT_PUBLIC_PUBLIC_URL = 'https://dash.example.com/';
        const mod = await importEnv();
        expect(mod.PUBLIC_URL).toBe('https://dash.example.com');
    });

    it('DISCORD_REDIRECT_URI defaults to PUBLIC_URL + /api/auth/discord/callback', async () => {
        process.env.PUBLIC_URL = 'https://site.test/';
        const mod = await importEnv();
        expect(mod.DISCORD_REDIRECT_URI).toBe('https://site.test/api/auth/discord/callback');
    });

    it('throws when required JWT env missing', async () => {
        vi.resetModules();
        delete process.env.JWT_SECRET;
        delete process.env.JWT_AUDIENCE;
        await expect(import('@/lib/env')).rejects.toThrow(/Missing required environment variable/);
    });

    it('API_URL defaults to http://localhost:3001 when env missing', async () => {
        const mod = await importEnv();
        expect(mod.API_URL).toBe('http://localhost:3001');
    });

    it('API_URL uses env value as-is (no trimming) when provided', async () => {
        process.env.API_URL = 'http://api:3001/';
        const mod = await importEnv();
        expect(mod.API_URL).toBe('http://api:3001/');
    });
});
