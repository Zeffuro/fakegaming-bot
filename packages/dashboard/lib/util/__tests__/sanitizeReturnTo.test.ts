import { describe, it, expect } from 'vitest';
import { sanitizeReturnTo } from '@/lib/util/sanitizeReturnTo.js';

describe('sanitizeReturnTo', () => {
    it('accepts simple absolute paths', () => {
        expect(sanitizeReturnTo('/dashboard')).toBe('/dashboard');
        expect(sanitizeReturnTo('/dashboard?x=1')).toBe('/dashboard?x=1');
        expect(sanitizeReturnTo('/')).toBe('/');
    });

    it('rejects non-string or empty input', () => {
        expect(sanitizeReturnTo(undefined)).toBeNull();
        expect(sanitizeReturnTo(null as unknown as string)).toBeNull();
        expect(sanitizeReturnTo('' as unknown as string)).toBeNull();
    });

    it('rejects external and protocol-relative URLs', () => {
        expect(sanitizeReturnTo('http://evil.com')).toBeNull();
        expect(sanitizeReturnTo('https://evil.com/foo')).toBeNull();
        expect(sanitizeReturnTo('//evil.com/foo')).toBeNull();
    });

    it('rejects paths with protocol markers', () => {
        expect(sanitizeReturnTo('/foohttps://bar')).toBeNull();
    });

    it('rejects overly long inputs', () => {
        const long = '/' + 'a'.repeat(2050);
        expect(sanitizeReturnTo(long)).toBeNull();
    });
});

