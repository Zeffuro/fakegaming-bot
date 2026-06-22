import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { withCacheMocks, mockCacheGet, mockCacheSet, setupCacheMocks, signTestJwt, expectUnauthorized, expectServiceUnavailable } from '@zeffuro/fakegaming-common/testing';

// Preserve original env and module state across tests
const OLD_ENV = { ...process.env };

// Helper to import module fresh with current env
async function importAuthUtils() {
    vi.resetModules();
    // Re-apply mocks cleared by resetModules so imports use the mocked cache
    setupCacheMocks();
    return await import('@/lib/auth/authUtils.js');
}

describe('authUtils', () => {
    withCacheMocks();

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        process.env.JWT_SECRET = 'supersecret';
        process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
        process.env.JWT_ISSUER = 'fakegaming';
        process.env.DISCORD_CLIENT_ID = 'discord-client';
        process.env.DISCORD_CLIENT_SECRET = 'discord-secret';
        delete process.env.DASHBOARD_ADMINS;
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe('authenticateUser', () => {
        it('returns 401 when no jwt cookie', async () => {
            const { authenticateUser } = await importAuthUtils();
            const req = { cookies: { get: (_name: string) => undefined } } as unknown as NextRequest;
            const res = await authenticateUser(req);
            expect(res.success).toBe(false);
            expectUnauthorized(res as any);
        }, 10000);

        it('returns user when valid jwt cookie present', async () => {
            const { authenticateUser } = await importAuthUtils();
            const token = signTestJwt({ discordId: '123' }, 'supersecret');
            const req = {
                cookies: {
                    get: (name: string) => name === 'jwt' ? { value: token } : undefined,
                },
            } as unknown as NextRequest;
            const res = await authenticateUser(req);
            expect(res.success).toBe(true);
            expect(res.user?.discordId).toBe('123');
        });

        it('returns 401 on invalid token', async () => {
            const { authenticateUser } = await importAuthUtils();
            const req = {
                cookies: {
                    get: (name: string) => name === 'jwt' ? { value: 'invalid' } : undefined,
                },
            } as unknown as NextRequest;
            const res = await authenticateUser(req);
            expect(res.success).toBe(false);
            expectUnauthorized(res as any);
        });
    });

    describe('isDashboardAdmin', () => {
        it('uses DASHBOARD_ADMINS env (captured at import time)', async () => {
            process.env.DASHBOARD_ADMINS = '42,  99';
            const { isDashboardAdmin } = await importAuthUtils();
            expect(isDashboardAdmin('42')).toBe(true);
            expect(isDashboardAdmin('99')).toBe(true);
            expect(isDashboardAdmin('100')).toBe(false);
        });
    });

    describe('checkGuildAccess', () => {
        it('returns admin access when user is dashboard admin', async () => {
            process.env.DASHBOARD_ADMINS = '777';
            const { checkGuildAccess } = await importAuthUtils();
            const result = await checkGuildAccess({ discordId: '777' }, 'anyGuild');
            expect(result.hasAccess).toBe(true);
            expect(result.isAdmin).toBe(true);
        });

        it('returns hasAccess true for guilds where user is admin (from cache)', async () => {
            const { checkGuildAccess } = await importAuthUtils();
            const result = await checkGuildAccess({ discordId: 'user1' }, 'guild1');
            expect(result.hasAccess).toBe(true);
            expect(result.isAdmin).toBe(false);
        });

        it('returns 503 when guilds are not cached and no request can refresh them', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const { checkGuildAccess } = await importAuthUtils();
            const result = await checkGuildAccess({ discordId: 'user2' }, 'guild1');
            expect(result.hasAccess).toBe(false);
            expectServiceUnavailable(result as any);
        });

        it('rehydrates guild access from Discord when the cache is missing', async () => {
            mockCacheGet.mockImplementation(async (key: string) => {
                if (key === 'user:user2:guilds') return null;
                if (key === 'user:user2:access_token') return null;
                if (key.startsWith('dashboard:refresh-session:')) {
                    return {
                        version: 1,
                        user: { id: 'user2', username: 'User Two' },
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        absoluteExpiresAt: Date.now() + 60_000,
                        discordRefreshToken: 'discord-refresh-token'
                    };
                }
                return null;
            });
            const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                const url = String(input);
                if (url === 'https://discord.com/api/oauth2/token') {
                    expect(init?.method).toBe('POST');
                    return new Response(JSON.stringify({ access_token: 'fresh-discord-token', expires_in: 3600 }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                if (url === 'https://discord.com/api/users/@me/guilds') {
                    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer fresh-discord-token');
                    return new Response(JSON.stringify([
                        { id: 'guild-fresh', owner: true, permissions: '0' }
                    ]), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                throw new Error(`Unexpected fetch: ${url}`);
            });
            vi.stubGlobal('fetch', fetchSpy);

            const req = {
                cookies: {
                    get: (name: string) => name === 'refresh_session' ? { value: 'refresh-token' } : undefined
                }
            } as unknown as NextRequest;

            const { checkGuildAccess } = await importAuthUtils();
            const result = await checkGuildAccess({ discordId: 'user2' }, 'guild-fresh', req);

            expect(result).toEqual({ hasAccess: true, isAdmin: false });
            expect(mockCacheSet).toHaveBeenCalledWith('user:user2:access_token', 'fresh-discord-token', 3_600_000);
            expect(mockCacheSet).toHaveBeenCalledWith('user:user2:guilds', [
                { id: 'guild-fresh', owner: true, permissions: '0' }
            ], 3_600_000);
        });
    });
});
