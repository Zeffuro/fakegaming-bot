/**
 * Tests for apiFetch in utils/api.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch } from '../api.js';

vi.mock('../auth.js', () => ({ getJwt: vi.fn() }));
import { getJwt } from '../auth.js';

global.fetch = vi.fn();

describe('apiFetch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should add Authorization header when token is present', async () => {
        (getJwt as any).mockResolvedValue('jwt-token');
        (global.fetch as any).mockResolvedValue('response');
        const result = await apiFetch('url', { headers: { 'X-Test': 'test' } });
        expect(global.fetch).toHaveBeenCalledWith('url', expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer jwt-token',
                'X-Test': 'test'
            })
        }));
        expect(result).toBe('response');
    });

    it('should not add Authorization header when token is missing', async () => {
        (getJwt as any).mockResolvedValue(undefined);
        (global.fetch as any).mockResolvedValue('response');
        const result = await apiFetch('url');
        expect(global.fetch).toHaveBeenCalledWith('url', expect.objectContaining({
            headers: {}
        }));
        expect(result).toBe('response');
    });

    it('should merge custom headers with Authorization', async () => {
        (getJwt as any).mockResolvedValue('jwt-token');
        (global.fetch as any).mockResolvedValue('response');
        await apiFetch('url', { headers: { 'X-Custom': 'custom' } });
        expect(global.fetch).toHaveBeenCalledWith('url', expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer jwt-token',
                'X-Custom': 'custom'
            })
        }));
    });

    it('should handle missing init', async () => {
        (getJwt as any).mockResolvedValue('jwt-token');
        (global.fetch as any).mockResolvedValue('response');
        await apiFetch('url');
        expect(global.fetch).toHaveBeenCalledWith('url', expect.objectContaining({
            headers: { Authorization: 'Bearer jwt-token' }
        }));
    });
});
