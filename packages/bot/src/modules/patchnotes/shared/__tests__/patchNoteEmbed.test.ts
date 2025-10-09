import { describe, it, expect } from 'vitest';
import { buildPatchNoteEmbed } from '../patchNoteEmbed.js';
import { EmbedBuilder } from 'discord.js';

describe('patchNoteEmbed', () => {
    it('should build embed with all fields', () => {
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: 'Test patch notes content',
            url: 'https://example.com/patch-1.0.0',
            publishedAt: new Date('2025-10-06T12:00:00Z'),
            accentColor: 0xFF5733,
            imageUrl: 'https://example.com/patch-image.jpg',
            logoUrl: 'https://example.com/logo.png',
        };

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
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: 'Test content',
            url: 'https://example.com/patch',
            publishedAt: new Date('2025-10-06'),
            accentColor: null,
        };

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.color).toBe(0x5865F2);
    });

    it('should handle null optional fields', () => {
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: 'Test content',
            url: 'https://example.com/patch',
            publishedAt: new Date('2025-10-06'),
            imageUrl: null,
            logoUrl: null,
        };

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.image).toBeUndefined();
        expect(embed.data.thumbnail).toBeUndefined();
    });

    it('should truncate long descriptions', () => {
        const longContent = 'A'.repeat(500);
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: longContent,
            url: 'https://example.com/patch',
            publishedAt: new Date('2025-10-06'),
        };

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.description!.length).toBeLessThanOrEqual(353); // 350 + "..."
    });

    it('should handle publishedAt as timestamp', () => {
        const timestamp = new Date('2025-10-06T12:00:00Z').getTime();
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: 'Test content',
            url: 'https://example.com/patch',
            publishedAt: timestamp,
        };

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.timestamp).toBeDefined();
    });

    it('should handle null publishedAt', () => {
        const patchNote = {
            id: '1',
            game: 'TestGame',
            title: 'Version 1.0.0',
            version: '1.0.0',
            content: 'Test content',
            url: 'https://example.com/patch',
            publishedAt: null,
        };

        const embed = buildPatchNoteEmbed(patchNote as any);

        expect(embed.data.timestamp).toBeDefined();
        expect(embed.data.footer).toBeUndefined();
    });
});
