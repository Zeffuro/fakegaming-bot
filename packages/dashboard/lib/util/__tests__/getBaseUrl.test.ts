import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBaseUrl } from '@/lib/util/getBaseUrl.js';
import type { NextRequest } from 'next/server';

function makeReq(headers: Record<string, string>): NextRequest {
    const hdrs = new Map<string, string>(Object.entries(headers));
    return {
        headers: {
            get: (key: string) => hdrs.get(key.toLowerCase()) ?? hdrs.get(key) ?? null,
        },
    } as unknown as NextRequest;
}

const OLD_ENV = { ...process.env };

describe('getBaseUrl', () => {
    beforeEach(() => {
        process.env = { ...OLD_ENV };
        delete process.env.NEXT_PUBLIC_PUBLIC_URL;
        delete process.env.PUBLIC_URL;
    });

    afterEach(() => {
        process.env = { ...OLD_ENV };
    });

    it('returns env URL when NEXT_PUBLIC_PUBLIC_URL is set', () => {
        process.env.NEXT_PUBLIC_PUBLIC_URL = 'https://example.com/';
        const url = getBaseUrl();
        expect(url).toBe('https://example.com');
    });

    it('builds URL from request headers with x-forwarded headers', () => {
        const req = makeReq({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'site.test' });
        const url = getBaseUrl(req);
        expect(url).toBe('https://site.test');
    });

    it('falls back to http for localhost host header', () => {
        const req = makeReq({ host: 'localhost:4000' });
        const url = getBaseUrl(req);
        expect(url).toBe('http://localhost:4000');
    });

    it('returns default localhost when no env and no req provided', () => {
        const url = getBaseUrl();
        expect(url).toBe('http://localhost:3000');
    });
});
