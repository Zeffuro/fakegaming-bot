import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import type { IncomingMessage } from 'node:http';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { QuoteConfig } from '@zeffuro/fakegaming-common/models';
import { signTestJwt, expectNotFound, expectUnauthorized, expectCreated, expectBadRequest, expectOk, expectInternalServerError, expectConflict } from '@zeffuro/fakegaming-common/testing';

let quoteId: string;
const testQuote = {
    id: 'test-quote-1',
    guildId: 'testguild1',
    authorId: 'testauthor1',
    submitterId: 'testsubmitter1',
    quote: 'This is a test quote.',
    timestamp: 1700000000000
};

type BinaryParserCallback = (error: Error | null, body: unknown) => void;
type SuperTestResponse = import('supertest').Response;

function parseBinaryResponse(res: SuperTestResponse, callback: BinaryParserCallback): void {
    const stream = res as unknown as IncomingMessage;
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => callback(null, Buffer.concat(chunks)));
    stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}

beforeEach(async () => {
    // Clean up quotes table before each test
    await configManager.quoteManager.removeAll();
    await configManager.quoteOfDayManager.removeAll();
    const created = await configManager.quoteManager.addPlain(testQuote);
    quoteId = created.id;
});

describe('Quotes API', () => {
    let token: string;
    beforeAll(() => {
        token = signTestJwt({ discordId: 'testuser' });
    });
    it('should list all quotes', async () => {
        const res = await request(app).get('/api/quotes').set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a quote by id', async () => {
        const res = await request(app).get(`/api/quotes/${quoteId}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.id).toBe(quoteId);
    });
    it('should get quotes by guild', async () => {
        const res = await request(app).get(`/api/quotes/guild/${testQuote.guildId}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((q: QuoteConfig) => q.guildId === testQuote.guildId)).toBe(true);
    });
    it('should get quotes by author in guild', async () => {
        const res = await request(app).get(`/api/quotes/guild/${testQuote.guildId}/author/${testQuote.authorId}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((q: QuoteConfig) => q.authorId === testQuote.authorId)).toBe(true);
    });
    it('should return empty array for non-existent author in guild', async () => {
        const res = await request(app).get('/api/quotes/guild/testguild1/author/nonexistentauthor').set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });
    it('should search quotes by text and guildId', async () => {
        const res = await request(app).get('/api/quotes/search').set('Authorization', `Bearer ${token}`)
            .query({guildId: testQuote.guildId, text: 'test quote'});
        expectOk(res);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((q: QuoteConfig) => q.quote.includes('test quote'))).toBe(true);
    });
    it('should add a new quote', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).post('/api/quotes').set('Authorization', `Bearer ${token}`).send({
            id: 'test-quote-2',
            guildId: 'testguild2',
            authorId: 'testauthor2',
            submitterId: 'testsubmitter2',
            quote: 'Another test quote.',
            timestamp: 1700000000001,
            tags: ['Funny', '#Raid Night'],
            source: 'voice chat',
            context: 'Before the pull',
        });
        expectCreated(res);
        expect(res.body.quote).toBe('Another test quote.');
        expect(res.body).toMatchObject({
            moderationStatus: 'pending',
            tags: ['funny', 'raid-night'],
            source: 'voice chat',
            context: 'Before the pull',
        });
    });

    it('should search quote metadata and return normalized tags', async () => {
        await configManager.quoteManager.addPlain({
            id: 'test-quote-meta',
            guildId: testQuote.guildId,
            authorId: 'testauthor-meta',
            submitterId: 'testsubmitter-meta',
            quote: 'Metadata searchable quote.',
            timestamp: 1700000000003,
            tags: '["raid-night","funny"]',
            source: 'Twitch clip',
            context: 'After the clear',
        });

        const res = await request(app).get('/api/quotes/search').set('Authorization', `Bearer ${token}`)
            .query({ guildId: testQuote.guildId, text: 'raid-night' });

        expectOk(res);
        expect(res.body).toEqual([
            expect.objectContaining({
                id: 'test-quote-meta',
                tags: ['raid-night', 'funny'],
                source: 'Twitch clip',
                context: 'After the clear',
            }),
        ]);
    });
    it('should delete a quote by id', async () => {
        // Add a quote to delete
        const created = await configManager.quoteManager.addPlain({
            id: 'test-quote-3',
            guildId: 'testguild3',
            authorId: 'testauthor3',
            submitterId: 'testsubmitter3',
            quote: 'To be deleted',
            timestamp: 1700000000002
        });
        const res = await request(app).delete(`/api/quotes/${created.id}`).set('Authorization', `Bearer ${token}`);
        expectOk(res);
        expect(res.body.success).toBe(true);
    });
    it('should update quote moderation status', async () => {
        const res = await request(app)
            .patch(`/api/quotes/${quoteId}/moderation`)
            .set('Authorization', `Bearer ${token}`)
            .send({ moderationStatus: 'approved' });

        expectOk(res);
        expect(res.body).toMatchObject({
            id: quoteId,
            moderationStatus: 'approved',
        });

        const updated = await configManager.quoteManager.getOnePlain({ id: quoteId });
        expect(updated?.moderationStatus).toBe('approved');
    });

    it('should render an approved quote card as PNG', async () => {
        await configManager.quoteManager.updateModerationStatus(quoteId, 'approved');

        const res = await request(app)
            .get(`/api/quotes/${quoteId}/card`)
            .set('Authorization', `Bearer ${token}`)
            .buffer(true)
            .parse(parseBinaryResponse);

        expectOk(res);
        expect(res.headers['content-type']).toContain('image/png');
        expect(res.headers['content-disposition']).toContain('quote-card-test-quote-1.png');
        const body = res.body as Buffer;
        expect(body.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });

    it('should reject quote card rendering for unapproved quotes', async () => {
        const res = await request(app)
            .get(`/api/quotes/${quoteId}/card`)
            .set('Authorization', `Bearer ${token}`);

        expectConflict(res);
        expect(res.body.error.code).toBe('QUOTE_NOT_APPROVED');
    });

    it('should reject invalid quote moderation status', async () => {
        const res = await request(app)
            .patch(`/api/quotes/${quoteId}/moderation`)
            .set('Authorization', `Bearer ${token}`)
            .send({ moderationStatus: 'hidden' });

        expectBadRequest(res);
    });

    it('should save quote-of-the-day settings for a guild', async () => {
        const res = await request(app)
            .put(`/api/quotes/guild/${testQuote.guildId}/quote-of-day/settings`)
            .set('Authorization', `Bearer ${token}`)
            .send({ channelId: 'channel-quote-day', enabled: true, runHourUtc: 9 });

        expectOk(res);
        expect(res.body).toMatchObject({
            guildId: testQuote.guildId,
            channelId: 'channel-quote-day',
            enabled: true,
            runHourUtc: 9,
        });

        const saved = await configManager.quoteOfDayManager.getForGuild(testQuote.guildId);
        expect(saved).toMatchObject({ enabled: true, channelId: 'channel-quote-day' });
    });

    it('should preview the deterministic quote of the day from approved quotes', async () => {
        await configManager.quoteManager.updateModerationStatus(quoteId, 'approved');
        await configManager.quoteManager.addPlain({
            id: 'test-quote-pending',
            guildId: testQuote.guildId,
            authorId: 'pending-author',
            submitterId: 'pending-submitter',
            quote: 'Pending quote',
            timestamp: 1700000000004,
        });
        await configManager.quoteOfDayManager.upsertForGuild({
            guildId: testQuote.guildId,
            channelId: 'channel-quote-day',
            enabled: true,
            runHourUtc: 9,
        });

        const res = await request(app)
            .get(`/api/quotes/guild/${testQuote.guildId}/quote-of-day`)
            .set('Authorization', `Bearer ${token}`)
            .query({ date: '2026-06-24' });

        expectOk(res);
        expect(res.body).toMatchObject({
            date: '2026-06-24',
            eligibleCount: 1,
            quote: expect.objectContaining({ id: quoteId, moderationStatus: 'approved' }),
            settings: expect.objectContaining({ enabled: true, channelId: 'channel-quote-day' }),
        });
    });

    it('should return 404 for non-existent quote', async () => {
        const res = await request(app).get('/api/quotes/nonexistentid').set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });
    it('should return 401 for GET /api/quotes without JWT', async () => {
        const res = await request(app).get('/api/quotes');
        expectUnauthorized(res);
    });

    it('should return 401 for POST /api/quotes without JWT', async () => {
        const res = await request(app)
            .post('/api/quotes')
            .send({id: 'test-quote-4', guildId: 'testguild4', authorId: 'author4', submitterId: 'submitter4', quote: 'quote4', timestamp: Date.now()});
        expectUnauthorized(res);
    });

    it('should return 401 for DELETE /api/quotes/:id without JWT', async () => {
        const res = await request(app)
            .delete(`/api/quotes/${quoteId}`);
        expectUnauthorized(res);
    });

    it('should return 404 when deleting non-existent quote', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .delete('/api/quotes/nonexistent')
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });

    it('should handle duplicate add gracefully', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res1 = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${token}`)
            .send(testQuote);
        if (res1.status === 201) {
            expectCreated(res1);
        } else {
            const { expectConflict } = await import('@zeffuro/fakegaming-common/testing');
            expectConflict(res1);
        }
    });

    it('should return 400 for invalid input types', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${token}`)
            .send({id: 123, guildId: null, authorId: null, submitterId: null, quote: null, timestamp: 'invalid'});
        expectBadRequest(res);
    });

    it('should return 500 for DB error on POST /api/quotes', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        // Simulate DB error by mocking addPlain
        const origAdd = configManager.quoteManager.addPlain;
        try {
            configManager.quoteManager.addPlain = async () => { throw new Error('DB error'); };
            const res = await request(app)
                .post('/api/quotes')
                .set('Authorization', `Bearer ${token}`)
                .send({id: 'test-quote-5', guildId: 'testguild1', authorId: 'author5', submitterId: 'submitter5', quote: 'quote5', timestamp: Date.now()});
            expectInternalServerError(res);
        } finally {
            configManager.quoteManager.addPlain = origAdd;
        }
    });

    it('should return 400 for missing search params', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .get('/api/quotes/search')
            .set('Authorization', `Bearer ${token}`)
            .query({});
        expectBadRequest(res);
    });

    it('should generate id and derive submitterId from JWT when omitted', async () => {
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app)
            .post('/api/quotes')
            .set('Authorization', `Bearer ${token}`)
            .send({
                // no id
                guildId: 'testguild1',
                authorId: 'author-n1',
                // no submitterId
                quote: 'Quote without client id',
                timestamp: Date.now()
            });
        expectCreated(res);
        expect(typeof res.body.id).toBe('string');
        expect(res.body.id.length).toBeGreaterThan(0);
        expect(res.body.submitterId).toBe('testuser');
    });
});
