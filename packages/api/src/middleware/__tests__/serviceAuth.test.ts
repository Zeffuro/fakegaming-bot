import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isServiceRequest, serviceAuth, shouldSkipJwt, tokenMatches } from '../serviceAuth.js';
import type { AuthenticatedRequest } from '../../types/express.js';

const ORIGINAL_ENV = { ...process.env };

function setServiceToken(value: string | undefined): void {
    delete process.env.SERVICE_API_TOKEN;
    delete process.env.INTERNAL_API_TOKEN;
    delete process.env.API_SERVICE_TOKEN;

    if (value !== undefined) {
        process.env.SERVICE_API_TOKEN = value;
    }
}

function makeRequest(token: string | undefined): Request {
    return {
        header: vi.fn((name: string) => {
            if (name.toLowerCase() !== 'x-service-token') {
                return undefined;
            }

            return token;
        }),
        headers: {},
        ip: '127.0.0.1',
        method: 'GET',
        originalUrl: '/internal/test',
    } as unknown as Request;
}

function callServiceAuth(req: Request): NextFunction {
    const next = vi.fn() as NextFunction;

    serviceAuth(req, {} as Response, next);

    return next;
}

describe('middleware/serviceAuth', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    it('compares service tokens without accepting length mismatches', () => {
        expect(tokenMatches('service-token', ['wrong', 'service-token'])).toBe(true);
        expect(tokenMatches('service-token', ['service-tokem'])).toBe(false);
        expect(tokenMatches('service-token', ['short'])).toBe(false);
    });

    it('authenticates requests with a configured service token', () => {
        setServiceToken('service-token');
        const req = makeRequest('service-token');

        const next = callServiceAuth(req);

        expect(next).toHaveBeenCalledOnce();
        expect(isServiceRequest(req)).toBe(true);
        expect(shouldSkipJwt(req)).toBe(true);
        expect((req as AuthenticatedRequest).user).toEqual({
            discordId: 'service:bot',
            username: 'service',
        });
    });

    it('matches service tokens when env values contain surrounding whitespace', () => {
        setServiceToken('  service-token  ');
        const req = makeRequest('service-token');

        const next = callServiceAuth(req);

        expect(next).toHaveBeenCalledOnce();
        expect(isServiceRequest(req)).toBe(true);
        expect(shouldSkipJwt(req)).toBe(true);
    });

    it('does nothing when no service tokens are configured', () => {
        setServiceToken(undefined);
        const req = makeRequest('service-token');

        const next = callServiceAuth(req);

        expect(next).toHaveBeenCalledOnce();
        expect(isServiceRequest(req)).toBe(false);
        expect(shouldSkipJwt(req)).toBe(false);
        expect((req as AuthenticatedRequest).user).toBeUndefined();
    });

    it('does not authenticate missing or invalid tokens', () => {
        setServiceToken('service-token');
        const missingTokenReq = makeRequest(undefined);
        const invalidTokenReq = makeRequest('wrong-token');

        const missingNext = callServiceAuth(missingTokenReq);
        const invalidNext = callServiceAuth(invalidTokenReq);

        expect(missingNext).toHaveBeenCalledOnce();
        expect(invalidNext).toHaveBeenCalledOnce();
        expect(isServiceRequest(missingTokenReq)).toBe(false);
        expect(shouldSkipJwt(missingTokenReq)).toBe(false);
        expect(isServiceRequest(invalidTokenReq)).toBe(false);
        expect(shouldSkipJwt(invalidTokenReq)).toBe(false);
    });
});
