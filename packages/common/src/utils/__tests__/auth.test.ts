/**
 * Tests for utils/auth.ts JWT utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJwt } from '../auth.js';

global.fetch = vi.fn();

// Mock localStorage for Node.js environment
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('getJwt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
    });

    it('should fetch token from API and store in localStorage', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ token: 'new-token' })
        });
        const token = await getJwt();
        expect(token).toBe('new-token');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/login'),
            expect.objectContaining({ method: 'POST' })
        );
        expect(localStorageMock.setItem).toHaveBeenCalledWith('jwt', 'new-token');
    });

    it('should return null if API request fails', async () => {
        (global.fetch as any).mockResolvedValue({ ok: false });
        const token = await getJwt();
        expect(token).toBeNull();
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should return null if API response has no token', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({})
        });
        const token = await getJwt();
        expect(token).toBeNull();
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));
        await expect(getJwt()).rejects.toThrow('Network error');
    });
});
