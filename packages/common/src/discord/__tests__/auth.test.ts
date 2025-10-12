/**
 * Tests for discord/auth.ts OAuth and user/guild fetch
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    exchangeCodeForToken,
    fetchDiscordUser,
    getDiscordGuilds,
    getDiscordOAuthUrl,
    issueJwt,
    verifyJwt,
    getDiscordGuildChannels
} from '../auth.js';

global.fetch = vi.fn();

// --- local helpers (DRY) ---
function mockRateLimitThenSuccess<T>(payload: T) {
    vi.mocked(global.fetch)
        .mockResolvedValueOnce({ status: 429, json: vi.fn().mockResolvedValue({ retry_after: 0.001 }) } as any)
        .mockResolvedValueOnce({ status: 200, ok: true, json: vi.fn().mockResolvedValue(payload) } as any);
}

function mockFailure(status: number, message: string) {
    vi.mocked(global.fetch).mockResolvedValueOnce({ status, ok: false, text: vi.fn().mockResolvedValue(message) } as any);
}

describe('exchangeCodeForToken', () => {
    it('should exchange code for token', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: vi.fn().mockResolvedValue({ access_token: 'token' })
        } as any);
        const result = await exchangeCodeForToken('code', 'id', 'secret', 'uri');
        expect(result).toEqual({ access_token: 'token' });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://discord.com/api/oauth2/token',
            expect.objectContaining({ method: 'POST' })
        );
    });
});

describe('fetchDiscordUser', () => {
    beforeEach(() => vi.clearAllMocks());
    it('should fetch user successfully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: vi.fn().mockResolvedValue({ id: '123' })
        } as any);
        const result = await fetchDiscordUser('token');
        expect(result).toEqual({ id: '123' });
    });
    it('should retry on rate limit and succeed', async () => {
        mockRateLimitThenSuccess({ id: '123' });
        const result = await fetchDiscordUser('token');
        expect(result).toEqual({ id: '123' });
    });
    it('should throw on failed request', async () => {
        mockFailure(400, 'fail');
        await expect(fetchDiscordUser('token')).rejects.toThrow('fail');
    });
});

describe('getDiscordGuilds', () => {
    beforeEach(() => vi.clearAllMocks());
    it('should fetch guilds successfully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: vi.fn().mockResolvedValue([{ id: 'guild' }])
        } as any);
        const result = await getDiscordGuilds('token');
        expect(result).toEqual([{ id: 'guild' }]);
    });
    it('should retry on rate limit and succeed', async () => {
        mockRateLimitThenSuccess([{ id: 'guild' }]);
        const result = await getDiscordGuilds('token');
        expect(result).toEqual([{ id: 'guild' }]);
    });
    it('should throw on failed request', async () => {
        mockFailure(400, 'fail');
        await expect(getDiscordGuilds('token')).rejects.toThrow('fail');
    });
});

describe('getDiscordOAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
        const url = getDiscordOAuthUrl('client123', 'http://localhost:3000/callback');
        expect(url).toContain('client_id=client123');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
        expect(url).toContain('response_type=code');
        expect(url).toContain('scope=identify%20guilds');
    });
});

describe('issueJwt', () => {
    it('should issue JWT with user data', () => {
        const user = {
            id: '123',
            username: 'testuser',
            global_name: 'Test User',
            avatar: 'avatar123',
            discriminator: '0001'
        };
        const token = issueJwt(user, 'secret');
        expect(token).toBeTruthy();
        expect(typeof token).toBe('string');
    });

    it('should handle missing optional fields', () => {
        const user = {
            id: '123',
            username: 'testuser'
        };
        const token = issueJwt(user, 'secret');
        expect(token).toBeTruthy();
    });
});

describe('verifyJwt', () => {
    it('should verify valid JWT', () => {
        const user = { id: '123', username: 'testuser' };
        const token = issueJwt(user, 'secret');
        const decoded = verifyJwt(token, 'secret');
        expect(decoded).toBeTruthy();
        expect((decoded as any).discordId).toBe('123');
        expect((decoded as any).username).toBe('testuser');
    });

    it('should throw on invalid JWT', () => {
        expect(() => verifyJwt('invalid-token', 'secret')).toThrow();
    });

    it('should throw on wrong secret', () => {
        const user = { id: '123', username: 'testuser' };
        const token = issueJwt(user, 'secret1');
        expect(() => verifyJwt(token, 'secret2')).toThrow();
    });
});

describe('getDiscordGuildChannels', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should fetch guild channels successfully', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            status: 200,
            ok: true,
            json: vi.fn().mockResolvedValue([
                { id: '1', type: 0, name: 'text' },
                { id: '2', type: 5, name: 'announcement' },
                { id: '3', type: 2, name: 'voice' }
            ])
        } as any);
        const result = await getDiscordGuildChannels('guild123', 'bot-token');
        expect(result).toHaveLength(2);
        expect(result).toEqual([
            { id: '1', type: 0, name: 'text' },
            { id: '2', type: 5, name: 'announcement' }
        ]);
    });

    it('should retry on rate limit and succeed', async () => {
        mockRateLimitThenSuccess([{ id: '1', type: 0, name: 'text' }]);
        const result = await getDiscordGuildChannels('guild123', 'bot-token');
        expect(result).toEqual([{ id: '1', type: 0, name: 'text' }]);
    });

    it('should throw on failed request', async () => {
        mockFailure(403, 'Forbidden');
        await expect(getDiscordGuildChannels('guild123', 'bot-token')).rejects.toThrow('Forbidden');
    });

    it('should throw after max retries on rate limit', async () => {
        vi.mocked(global.fetch)
            .mockResolvedValueOnce({ status: 429, json: vi.fn().mockResolvedValue({ retry_after: 0.001 }) } as any)
            .mockResolvedValueOnce({ status: 429, json: vi.fn().mockResolvedValue({ retry_after: 0.001 }) } as any)
            .mockResolvedValueOnce({ status: 429, json: vi.fn().mockResolvedValue({ retry_after: 0.001 }) } as any);
        await expect(getDiscordGuildChannels('guild123', 'bot-token')).rejects.toThrow('Discord rate limit exceeded for guild channels');
    });
});
