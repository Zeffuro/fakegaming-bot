import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../utils/template.js';

describe('renderTemplate', () => {
    it('replaces tokens with provided string values', () => {
        const out = renderTemplate('Hello {name}, welcome to {place}!', { name: 'Alice', place: 'Wonderland' });
        expect(out).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('coerces numbers and leaves other text intact', () => {
        const out = renderTemplate('{count} items in {place}', { count: 42, place: 'cart' });
        expect(out).toBe('42 items in cart');
    });

    it('replaces missing or nullish tokens with empty string', () => {
        const out = renderTemplate('User {name} has {points} points', { name: undefined, points: null });
        expect(out).toBe('User  has  points');
    });

    it('supports token keys with dashes, colons and underscores', () => {
        const out = renderTemplate('{user-id}:{scope_name}', { 'user-id': 'u1', 'scope_name': 's', 'scope:name': 'ignored' });
        expect(out).toBe('u1:s');
    });
});
