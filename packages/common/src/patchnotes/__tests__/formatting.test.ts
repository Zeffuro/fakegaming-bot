import { describe, expect, it } from 'vitest';
import { formatPatchNoteEmbedDescription, htmlToDiscordText, PATCH_NOTE_EMBED_DESCRIPTION_LIMIT } from '../formatting.js';

describe('patch note formatting', () => {
    it('converts article html into Discord-friendly text', () => {
        const text = htmlToDiscordText(`
            <p>Intro&nbsp;text</p>
            <h2>All Platforms</h2>
            <ul>
                <li>General update<ul><li>Nested fix</li></ul></li>
            </ul>
        `);

        expect(text).toContain('Intro text');
        expect(text).toContain('**All Platforms**');
        expect(text).toContain('- General update');
        expect(text).toContain('  - Nested fix');
    });

    it('truncates descriptions under the embed limit', () => {
        const description = formatPatchNoteEmbedDescription('A'.repeat(PATCH_NOTE_EMBED_DESCRIPTION_LIMIT + 100));

        expect(description.length).toBeLessThanOrEqual(PATCH_NOTE_EMBED_DESCRIPTION_LIMIT);
        expect(description.endsWith('...')).toBe(true);
    });

    it('keeps descriptions that are already under the limit', () => {
        expect(formatPatchNoteEmbedDescription('Short patch note')).toBe('Short patch note');
    });

    it('prefers paragraph boundaries when truncating', () => {
        const content = `${'Intro '.repeat(250)}\n\n${'Details '.repeat(250)}`;
        const description = formatPatchNoteEmbedDescription(content, 1200);

        expect(description.endsWith('...')).toBe(true);
        expect(description).not.toContain('Details');
    });

    it('falls back to sentence boundaries when paragraph boundaries are not useful', () => {
        const content = `${'Intro sentence. '.repeat(80)}Final details that should not fit.`;
        const description = formatPatchNoteEmbedDescription(content, 700);

        expect(description.endsWith('...')).toBe(true);
        expect(description).toContain('Intro sentence.');
    });

    it('falls back to word boundaries for unsentenced text', () => {
        const content = `${'word '.repeat(200)}tail`;
        const description = formatPatchNoteEmbedDescription(content, 500);

        expect(description.endsWith('...')).toBe(true);
        expect(description.length).toBeLessThanOrEqual(500);
    });
});
