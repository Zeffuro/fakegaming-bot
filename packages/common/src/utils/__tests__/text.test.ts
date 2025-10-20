import { describe, it, expect } from 'vitest';
import { cleanDiscordContent } from '../text.js';

describe('cleanDiscordContent', () => {
    it('removes tabs, collapses multiple newlines, and trims', () => {
        const raw = '\tHello\n\n\nWorld\t\n\n!   ';
        const cleaned = cleanDiscordContent(raw);
        expect(cleaned).toBe('Hello\nWorld\n!');
    });

    it('returns empty string when only whitespace and tabs', () => {
        const raw = '\t\n\n \t  ';
        const cleaned = cleanDiscordContent(raw);
        expect(cleaned).toBe('');
    });
});

