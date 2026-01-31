/**
 * Tests for error handler middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler.js';

describe('errorHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        mockReq = {};
        mockRes = {
            status: statusMock,
            json: jsonMock
        } as unknown as Response;
        mockNext = vi.fn();
    });

    it('should handle UnauthorizedError with 401 status', () => {
        const error = { name: 'UnauthorizedError', message: 'Token expired' };
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({
            error: { code: 'UNAUTHORIZED', message: 'Token expired' }
        });
    });

    it('should handle 400 errors with Bad Request', () => {
        const error = { status: 400, message: 'Invalid input' };
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
            error: { code: 'BAD_REQUEST', message: 'Invalid input' }
        });
    });

    it('should handle 404 errors with Not Found', () => {
        const error = { status: 404, message: 'Resource not found' };
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
            error: { code: 'NOT_FOUND', message: 'Resource not found' }
        });
    });

    it('should handle unknown errors with 500 status', () => {
        const error = { message: 'Something went wrong' };
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' }
        });
    });

    it('should use fallback message for errors without message', () => {
        const error = {};
        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error' }
        });
    });
});
