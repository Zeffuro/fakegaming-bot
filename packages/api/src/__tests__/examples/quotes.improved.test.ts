/**
 * Example of improved API testing with new infrastructure
 * This shows the recommended pattern for testing API routes
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import {
    setupApiRouteTest,
    signTestJwt,
    createMockQuote,
    expectUnauthorized,
    expectOk,
    seedUserGuilds
} from '@zeffuro/fakegaming-common/testing';
import type { Express } from 'express';

describe('Quotes API (Improved Pattern)', () => {
    let app: Express;
    let token: string;

    beforeEach(async () => {
        // Setup API test with automatic mocking
        const { createApp, configManager } = await setupApiRouteTest();

        // Configure mock data
        const mockQuotes = [
            createMockQuote({ id: '1', guildId: 'guild1', quote: 'Test quote 1' }),
            createMockQuote({ id: '2', guildId: 'guild1', quote: 'Test quote 2' }),
            createMockQuote({ id: '3', guildId: 'guild2', quote: 'Different guild' }),
        ];

        vi.mocked(configManager.quoteManager).getAllPlain.mockResolvedValue(mockQuotes as any);
        vi.mocked(configManager.quoteManager).getQuotesByGuild.mockImplementation(async (guildId: string) => {
            return mockQuotes.filter(q => q.guildId === guildId) as any;
        });

        // Create app instance
        app = await createApp();

        // Generate test JWT
        token = signTestJwt({ discordId: 'testuser' });

        // Seed guild access for the JWT user to avoid 403 in auth checks
        await seedUserGuilds('testuser', [ { id: 'guild1', permissions: '8' } ]);
    });

    describe('GET /api/quotes', () => {
        it('should return all quotes', async () => {
            const res = await request(app)
                .get('/api/quotes')
                .set('Authorization', `Bearer ${token}`);

            expectOk(res);
            expect(res.body).toHaveLength(3);
        });

        it('should return 401 without authentication', async () => {
            const res = await request(app).get('/api/quotes');

            expectUnauthorized(res);
        });
    });

    describe('GET /api/quotes/guild/:guildId', () => {
        it('should return quotes for specific guild', async () => {
            const res = await request(app)
                .get('/api/quotes/guild/guild1')
                .set('Authorization', `Bearer ${token}`);

            expectOk(res);
            expect(res.body).toHaveLength(2);
            expect(res.body.every((q: any) => q.guildId === 'guild1')).toBe(true);
        });
    });
});
