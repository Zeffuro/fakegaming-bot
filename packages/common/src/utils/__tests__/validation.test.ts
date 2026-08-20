import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateBody } from '../validation.js';

function responseMock() {
    const json = vi.fn();
    const response = {
        status: vi.fn(() => response),
        json,
    } as unknown as Response;
    return { response, json };
}

describe('validation localization callback', () => {
    it('preserves the existing English response by default', async () => {
        const req = { body: {} } as Request;
        const { response, json } = responseMock();

        await validateBody(z.object({ name: z.string() }))(req, response, vi.fn() as NextFunction);

        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.objectContaining({ message: 'Body validation failed' }),
        }));
    });

    it('allows a caller to localize the summary and issue details', async () => {
        const req = { body: {} } as Request;
        const { response, json } = responseMock();
        const localizeError = vi.fn(() => ({
            message: 'Inhoud ongeldig',
            details: [{ path: 'name', message: 'Verplicht' }],
        }));

        await validateBody(z.object({ name: z.string() }), { localizeError })(
            req,
            response,
            vi.fn() as NextFunction,
        );

        expect(localizeError).toHaveBeenCalledWith(req, 'Body', expect.any(Array));
        expect(json).toHaveBeenCalledWith({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Inhoud ongeldig',
                details: [{ path: 'name', message: 'Verplicht' }],
            },
        });
    });
});
