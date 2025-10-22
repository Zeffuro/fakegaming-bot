import { describe, it, expect } from 'vitest';
import { sanitizeTikTokUsername } from '../tiktok.js';

describe('TikTok utils', () => {
    it('sanitizes a username by removing leading @', () => {
        expect(sanitizeTikTokUsername('@TestUser')).toBe('TestUser');
        expect(sanitizeTikTokUsername('user')).toBe('user');
        expect(sanitizeTikTokUsername(' @user ')).toBe('user');
    });
});
