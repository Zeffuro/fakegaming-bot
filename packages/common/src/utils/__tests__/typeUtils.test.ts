import { describe, it, expect } from 'vitest';
import { asValidated } from '../typeUtils.js';


describe('asValidated', () => {
    it('should cast unknown value to specified type', () => {
        const input: unknown = { name: 'test', value: 123 };
        const result = asValidated<{ name: string; value: number }>(input);

        expect(result.name).toBe('test');
        expect(result.value).toBe(123);
    });

    it('should work with primitive types', () => {
        const str = asValidated<string>('hello');
        expect(str).toBe('hello');

        const num = asValidated<number>(42);
        expect(num).toBe(42);
    });
});