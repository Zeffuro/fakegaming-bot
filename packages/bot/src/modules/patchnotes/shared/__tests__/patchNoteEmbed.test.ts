import { describe, it, expect } from 'vitest';
import { buildPatchNoteEmbed } from '../patchNoteEmbed.js';
import { EmbedBuilder } from 'discord.js';

// Tiny factory to DRY patch note creation across tests
function makePatchNote(overrides: Record<string, unknown> = {}) {
    return {
        id: '1',
        game: 'TestGame',
        title: 'Version 1.0.0',
        version: '1.0.0',
        content: 'Test content',
        url: 'https://example.com/patch',
        publishedAt: new Date('2025-10-06T12:00:00Z'),
        ...overrides
    } as any;
}

describe('patchNoteEmbed', () => {
    it('should build embed with all fields', () => {
        const patchNote = makePatchNote({
            content: 'Test patch notes content',
            url: 'https://example.com/patch-1.0.0',
            accentColor: 0xFF5733,
            imageUrl: 'https://example.com/patch-image.jpg',
            logoUrl: 'https://example.com/logo.png',
        });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed).toBeInstanceOf(EmbedBuilder);
        expect(embed.data.title).toBe('Version 1.0.0');
        expect(embed.data.description).toContain('Test patch notes content');
        expect(embed.data.url).toBe('https://example.com/patch-1.0.0');
        expect(embed.data.color).toBe(0xFF5733);
        expect(embed.data.image?.url).toBe('https://example.com/patch-image.jpg');
        expect(embed.data.thumbnail?.url).toBe('https://example.com/logo.png');
        expect(embed.data.author?.name).toBe('TestGame');
    });

    it('should use default color when accentColor is null', () => {
        const patchNote = makePatchNote({ publishedAt: new Date('2025-10-06'), accentColor: null });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.color).toBe(0x5865F2);
    });

    it('should handle null optional fields', () => {
        const patchNote = makePatchNote({ publishedAt: new Date('2025-10-06'), imageUrl: null, logoUrl: null });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.image).toBeUndefined();
        expect(embed.data.thumbnail).toBeUndefined();
    });

    it('should truncate long descriptions', () => {
        const longContent = 'A'.repeat(500);
        const patchNote = makePatchNote({ content: longContent, publishedAt: new Date('2025-10-06') });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.description!.length).toBeLessThanOrEqual(353); // 350 + "..."
    });

    it('should handle publishedAt as timestamp', () => {
        const timestamp = new Date('2025-10-06T12:00:00Z').getTime();
        const patchNote = makePatchNote({ publishedAt: timestamp });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.timestamp).toBeDefined();
    });

    it('should handle null publishedAt', () => {
        const patchNote = makePatchNote({ publishedAt: null });

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.timestamp).toBeDefined();
        expect(embed.data.footer).toBeUndefined();
    });
});
