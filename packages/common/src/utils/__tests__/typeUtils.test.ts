import { describe, it, expect } from 'vitest';
import { asValidated } from '../typeUtils.js';

describe('asValidated', () => {
    it('casts a value to the desired compile-time type without changing runtime value', () => {
        const input: unknown = { x: 1, y: 'two' };
        const result = asValidated<{ x: number; y: string }>(input);
        // Runtime identity check
        expect(result).toBe(input);
        // Property checks at runtime
        expect(result.x).toBe(1);
        expect(result.y).toBe('two');
    });
});

