// Shared member search rate limiter store so tests and router share the same buckets

export interface RateBucket {
    tokens: number;
    lastRefill: number;
}

export const memberSearchRateBuckets = new Map<string, RateBucket>();

export function clearMemberSearchRateLimitsForTest(): void {
    memberSearchRateBuckets.clear();
}

