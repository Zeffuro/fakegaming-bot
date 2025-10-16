import { describe, it, expect } from 'vitest';
import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { givenAuthenticatedClient } from '../apiClient.js';
import { verifyTestJwt } from '../jwtTestUtils.js';
import { expectOk, expectUnauthorized } from '../assertions.js';

function createHandler() {
    return (req: IncomingMessage, res: ServerResponse): void => {
        const auth = req.headers['authorization'];
        if (!auth) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ auth }));
    };
}

describe('givenAuthenticatedClient', () => {
    it('attaches Authorization header with Bearer token and decodes the token payload', async () => {
        const handler = createHandler();
        const app = handler as unknown as Express;
        const client = givenAuthenticatedClient(app, { discordId: 'myuser' });

        const res = await client.get('/check');
        expectOk(res);
        expect(res.body).toBeTypeOf('object');
        expect(res.body.auth).toBe(`Bearer ${client.token}`);

        const decoded = verifyTestJwt(client.token) as { discordId?: string };
        expect(decoded.discordId).toBe('myuser');
    });

    it('does not set Authorization header on raw client', async () => {
        const handler = createHandler();
        const app = handler as unknown as Express;
        const client = givenAuthenticatedClient(app);

        const res = await client.raw.get('/check');
        expectUnauthorized(res);
        expect(res.body.error).toBe('Unauthorized');
    });

    it('applies Authorization header for POST/PUT/DELETE convenience methods', async () => {
        const handler = createHandler();
        const app = handler as unknown as Express;
        const client = givenAuthenticatedClient(app);

        const postRes = await client.post('/check', { foo: 'bar' });
        expectOk(postRes);
        expect(postRes.body.auth).toBe(`Bearer ${client.token}`);

        const putRes = await client.put('/check', { foo: 'baz' });
        expectOk(putRes);
        expect(putRes.body.auth).toBe(`Bearer ${client.token}`);

        const delRes = await client.delete('/check');
        expectOk(delRes);
        expect(delRes.body.auth).toBe(`Bearer ${client.token}`);
    });
});
