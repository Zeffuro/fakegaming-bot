import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * Extended Request type with user property for authenticated requests
 */
export interface AuthenticatedRequest extends Request {
    user: {
        discordId: string;
        iat: number;
        aud: string;
    };
}

/**
 * Creates a mock Express Request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
        body: {},
        params: {},
        query: {},
        headers: {},
        get: vi.fn((name: string) => {
            const headers = (overrides.headers || {}) as Record<string, string>;
            return headers[name.toLowerCase()];
        }) as any,
        ...overrides,
    };
}

/**
 * Creates a mock Express Response object
 */
export function createMockResponse(): {
    res: Partial<Response>;
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    sendStatus: ReturnType<typeof vi.fn>;
} {
    const json = vi.fn();
    const status = vi.fn();
    const send = vi.fn();
    const sendStatus = vi.fn();

    const res: Partial<Response> = {
        json,
        status: status.mockReturnThis(),
        send,
        sendStatus,
    };

    return { res, json, status, send, sendStatus };
}

/**
 * Creates a mock Express NextFunction
 */
export function createMockNext(): NextFunction {
    return vi.fn();
}

/**
 * Creates a mock authenticated request with JWT user
 */
export function createMockAuthRequest(
    discordId: string,
    overrides: Partial<Request> = {}
): Partial<AuthenticatedRequest> {
    return {
        ...createMockRequest(overrides),
        user: {
            discordId,
            iat: Math.floor(Date.now() / 1000),
            aud: 'fakegaming-dashboard',
        },
    } as Partial<AuthenticatedRequest>;
}
