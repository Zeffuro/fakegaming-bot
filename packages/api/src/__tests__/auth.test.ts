/**
 * Tests for auth route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { router as authRouter } from '../routes/auth.js';
import { expectBadRequest, expectUnauthorized, expectErrorCode, expectOk, expectInternalServerError } from '@zeffuro/fakegaming-common/testing';

// Mock the common package functions
vi.mock('@zeffuro/fakegaming-common/discord', () => ({
    exchangeCodeForToken: vi.fn(),
    fetchDiscordUser: vi.fn(),
    issueJwt: vi.fn()
}));

const { exchangeCodeForToken, fetchDiscordUser, issueJwt } = await import('@zeffuro/fakegaming-common/discord');

describe('POST /auth/login', () => {
    let app: express.Application;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/auth', authRouter);

        // Set required environment variables
        process.env.DISCORD_CLIENT_ID = 'test-client-id';
        process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
        process.env.DISCORD_REDIRECT_URI = 'http://localhost:3000/callback';
        process.env.JWT_SECRET = 'test-jwt-secret';
        process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
        process.env.JWT_ISSUER = 'fakegaming-test';
    });

    it('should return 400 if code is missing', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({});

        expectBadRequest(response);
        expect(response.body.error.message).toBe('Body validation failed');
        expect(Array.isArray(response.body.error.details)).toBe(true);
    });

    it('should return 401 if access token is missing', async () => {
        (exchangeCodeForToken as any).mockResolvedValue({ access_token: null });

        const response = await request(app)
            .post('/auth/login')
            .send({ code: 'test-code' });

        expectUnauthorized(response);
        expect(response.body.error.message).toBe('Invalid Discord OAuth code');
        expectErrorCode(response, 'UNAUTHORIZED');
    });

    it('should return JWT token and user info on successful login', async () => {
        const mockUser = {
            id: '123',
            username: 'testuser',
            discriminator: '0001',
            avatar: 'avatar123'
        };

        (exchangeCodeForToken as any).mockResolvedValue({ access_token: 'discord-token' });
        (fetchDiscordUser as any).mockResolvedValue(mockUser);
        (issueJwt as any).mockReturnValue('jwt-token');

        const response = await request(app)
            .post('/auth/login')
            .send({ code: 'test-code' });

        expectOk(response);
        expect(response.body.token).toBe('jwt-token');
        expect(response.body.user).toEqual(mockUser);
        expect(exchangeCodeForToken).toHaveBeenCalledWith(
            'test-code',
            'test-client-id',
            'test-client-secret',
            'http://localhost:3000/callback'
        );
        expect(fetchDiscordUser).toHaveBeenCalledWith('discord-token');
        expect(issueJwt).toHaveBeenCalled();
    });

    it('should return 500 on error', async () => {
        (exchangeCodeForToken as any).mockRejectedValue(new Error('Discord API error'));

        const response = await request(app)
            .post('/auth/login')
            .send({ code: 'test-code' });

        expectInternalServerError(response);
        expect(response.body.error.message).toBe('Failed to authenticate with Discord');
        expectErrorCode(response, 'INTERNAL_SERVER_ERROR');
    });
});
