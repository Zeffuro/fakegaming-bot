import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApiError, NotFoundError, ForbiddenError, __setApiErrorLogger } from '../apiErrorHelpers.js';

// Create a stable test logger with spies
const testLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

describe('handleApiError', () => {
    let res: any;

    beforeEach(() => {
        res = {
            _status: undefined as number | undefined,
            _json: undefined as any,
            status: vi.fn(function (this: any, code: number) { this._status = code; return this; }),
            json: vi.fn(function (this: any, payload: any) { this._json = payload; return this; })
        };
        testLogger.error.mockClear();
        testLogger.info.mockClear();
        testLogger.warn.mockClear();
        vi.clearAllMocks();
        __setApiErrorLogger(testLogger);
    });

    it('returns 404 for NotFoundError', () => {
        handleApiError(res, new NotFoundError('missing'), 'not found', 'forbidden', '[API]', 'error');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'missing' });
    });

    it('returns 403 for ForbiddenError', () => {
        handleApiError(res, new ForbiddenError('nope'), 'not found', 'forbidden', '[API]', 'error');
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'nope' });
    });

    it('returns 404 when error message contains "not found"', () => {
        handleApiError(res, new Error('resource Not Found'), 'nf', 'fb', '[API]', 'err');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'resource Not Found' });
    });

    it('returns 403 when error message contains "forbidden"', () => {
        handleApiError(res, new Error('Forbidden by policy'), 'nf', 'fb', '[API]', 'err');
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden by policy' });
    });

    it('returns 500 and logs for other errors', () => {
        handleApiError(res, new Error('boom'), 'nf', 'fb', '[API]', 'oops');
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'oops' });
        expect(testLogger.error).toHaveBeenCalled();
    });
});
