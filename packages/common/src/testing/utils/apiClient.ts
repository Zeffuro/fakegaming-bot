/**
 * Shared authenticated SuperTest client helper for API tests across packages.
 */
import type { Express } from 'express';
import request from 'supertest';
import type { Test } from 'supertest';
import { signTestJwt } from './jwtTestUtils.js';

/**
 * Authenticated client contract for use in API tests.
 */
export interface AuthClient {
    /** The signed JWT used by this client. */
    token: string;
    /** The underlying SuperTest client without auth header pre-applied. */
    raw: ReturnType<typeof request>;
    /** Issue a GET request with Authorization header applied. */
    get: (path: string) => Test;
    /** Issue a POST request with Authorization header applied and optional body. */
    post: (path: string, body?: Record<string, unknown> | string) => Test;
    /** Issue a PUT request with Authorization header applied and optional body. */
    put: (path: string, body?: Record<string, unknown> | string) => Test;
    /** Issue a DELETE request with Authorization header applied. */
    delete: (path: string) => Test;
}

/**
 * Options for creating an authenticated API test client.
 */
export interface GivenAuthClientOptions {
    /** Discord user id to encode in the JWT; defaults to "testuser". */
    discordId?: string;
}

/**
 * Create an authenticated SuperTest client with a signed JWT for the given Discord user id.
 *
 * @param app Express app instance under test.
 * @param options Optional parameters like the discordId to embed in the token.
 * @returns An AuthClient with convenience methods that auto-attach the Authorization header.
 */
export function givenAuthenticatedClient(app: Express, options: GivenAuthClientOptions = {}): AuthClient {
    const discordId = options.discordId ?? 'testuser';
    const token = signTestJwt({ discordId });
    const raw = request(app);

    const withAuth = (t: Test): Test => t.set('Authorization', `Bearer ${token}`);

    return {
        token,
        raw,
        get: (path: string) => withAuth(raw.get(path)),
        post: (path: string, body?: Record<string, unknown> | string) => {
            const t = withAuth(raw.post(path));
            return body === undefined ? t : t.send(body);
        },
        put: (path: string, body?: Record<string, unknown> | string) => {
            const t = withAuth(raw.put(path));
            return body === undefined ? t : t.send(body);
        },
        delete: (path: string) => withAuth(raw.delete(path)),
    };
}
