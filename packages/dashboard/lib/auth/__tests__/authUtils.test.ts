import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { withCacheMocks, mockCacheGet, setupCacheMocks, signTestJwt, expectUnauthorized, expectServiceUnavailable } from '@zeffuro/fakegaming-common/testing';

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
        delete process.env.DASHBOARD_ADMINS;
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
        vi.restoreAllMocks();
    });

    describe('authenticateUser', () => {
        it('returns 401 when no jwt cookie', async () => {
            const { authenticateUser } = await importAuthUtils();
            const req = { cookies: { get: (_name: string) => undefined } } as unknown as NextRequest;
            const res = await authenticateUser(req);
            expect(res.success).toBe(false);
            expectUnauthorized(res as any);
        });

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

        it('returns 503 when guilds not cached (redis unavailable)', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const { checkGuildAccess } = await importAuthUtils();
            const result = await checkGuildAccess({ discordId: 'user2' }, 'guild1');
            expect(result.hasAccess).toBe(false);
            expectServiceUnavailable(result as any);
        });
    });
});
