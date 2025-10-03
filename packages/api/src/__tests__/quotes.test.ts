import request from 'supertest';
import app from '../app.js';
import {configManager} from '../jest.setup.js';
import {QuoteConfig} from '@zeffuro/fakegaming-common/models';
import {signTestJwt} from '../testUtils/jwt.js';

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
    await configManager.quoteManager.remove({});
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
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
    it('should get a quote by id', async () => {
        const res = await request(app).get(`/api/quotes/${quoteId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(quoteId);
    });
    it('should get quotes by guild', async () => {
        const res = await request(app).get(`/api/quotes/guild/${testQuote.guildId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((q: QuoteConfig) => q.guildId === testQuote.guildId)).toBe(true);
    });
    it('should get quotes by author in guild', async () => {
        const res = await request(app).get(`/api/quotes/guild/${testQuote.guildId}/author/${testQuote.authorId}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((q: QuoteConfig) => q.authorId === testQuote.authorId)).toBe(true);
    });
    it('should return empty array for non-existent author in guild', async () => {
        const res = await request(app).get('/api/quotes/guild/testguild1/author/nonexistentauthor').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
    });
    it('should search quotes by text and guildId', async () => {
        const res = await request(app).get('/api/quotes/search').set('Authorization', `Bearer ${token}`)
            .query({guildId: testQuote.guildId, text: 'test quote'});
        expect(res.status).toBe(200);
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
        expect(res.status).toBe(201);
        expect(res.body.quote).toBe('Another test quote.');
    });
    it('should delete a quote by id', async () => {
        // Add a quote to delete
        const created = await configManager.quoteManager.addPlain({
            id: 'test-quote-3',
            guildId: 'testguild3',
            authorId: 'testauthor3',
            submitterId: 'testsubmitter3',
            quote: 'To be deleted.',
            timestamp: 1700000000002
        });
        const token = signTestJwt({ discordId: 'testuser' });
        const res = await request(app).delete(`/api/quotes/${created.id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    it('should return 404 for non-existent quote', async () => {
        const res = await request(app).get('/api/quotes/999999').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
    it('should return 400 for missing search params', async () => {
        const res = await request(app).get('/api/quotes/search').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
});
