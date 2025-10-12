import { beforeEach, afterEach, vi, expect } from 'vitest';

/**
 * Minimal shape of a mocked fetch Response for tests
 */
export interface MockedFetchResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}

export type FetchArgs = [input: string | URL | unknown, init?: Record<string, unknown>];
export type FetchMock = ReturnType<typeof vi.fn>;

/**
 * Sets up global fetch mock for a test suite and provides convenience helpers.
 *
 * Usage:
 * const { mockOkJsonOnce, mockErrorJsonOnce, expectFetchCalledWith } = withFetchMock();
 */
export function withFetchMock() {
    const g = globalThis as unknown as { fetch?: FetchMock };

    beforeEach(() => {
        g.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete g.fetch;
    });

    function getFetchMock(): FetchMock {
        if (!g.fetch) {
            // Ensure type safety in strict mode
            g.fetch = vi.fn();
        }
        return g.fetch as FetchMock;
    }

    function mockJsonOnce(payload: unknown, status: number): void {
        const ok = status >= 200 && status < 300;
        (getFetchMock() as any).mockResolvedValueOnce({ ok, status, json: async () => payload });
    }

    function mockOkJsonOnce(payload: unknown, status: number = 200): void {
        mockJsonOnce(payload, status);
    }

    function mockErrorJsonOnce(status: number, payload: unknown = { error: 'Error' }): void {
        mockJsonOnce(payload, status);
    }

    function mockRejectOnce(error: unknown): void {
        (getFetchMock() as any).mockRejectedValueOnce(error);
    }

    function expectFetchCalledWith(url: string, initMatcher: Record<string, unknown>): void {
        expect(getFetchMock()).toHaveBeenCalledWith(url, expect.objectContaining(initMatcher));
    }

    return {
        getFetchMock,
        mockJsonOnce,
        mockOkJsonOnce,
        mockErrorJsonOnce,
        mockRejectOnce,
        expectFetchCalledWith,
    } as const;
}
