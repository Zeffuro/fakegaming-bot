import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { configManager } from '../vitest.setup.js';
import { QuoteConfig } from '@zeffuro/fakegaming-common/models';
import { signTestJwt, expectNotFound, expectUnauthorized, expectCreated, expectBadRequest, expectOk, expectInternalServerError } from '@zeffuro/fakegaming-common/testing';

let quoteId: string;
const testQuote = {
    id: 'test-quote-1',
    guildId: 'testguild1',
    authorId: 'testauthor1',
    submitterId: 'testsubmitter1',
    quote: 'This is a test quote.',
    timestamp: 1700000000000
};

beforeEach(async () => {
    // Clean up quotes table before each test
    await configManager.quoteManager.removeAll();
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
            timestamp: 1700000000001
        });
        expectCreated(res);
        expect(res.body.quote).toBe('Another test quote.');
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
