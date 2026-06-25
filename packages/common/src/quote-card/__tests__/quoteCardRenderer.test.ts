import { describe, expect, it } from 'vitest';
import { buildQuoteCardFilename, renderQuoteCard } from '../quoteCardRenderer.js';

describe('quoteCardRenderer', () => {
    it('renders a PNG buffer for a quote card', () => {
        const buffer = renderQuoteCard({
            quote: 'Stack markers on the left and stop inventing mechanics.',
            authorName: 'Raid Lead',
            authorId: '123456789012345678',
            submitterName: 'Curator',
            timestamp: 1782400000000,
            tags: ['raid-night', 'mechanics'],
            source: 'voice chat',
            context: 'Progression pull',
            guildName: 'Test Guild',
        });

        expect(buffer.length).toBeGreaterThan(10_000);
        expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });

    it('builds safe filenames', () => {
        expect(buildQuoteCardFilename(' Quote/One? ')).toBe('quote-card-quote-one.png');
        expect(buildQuoteCardFilename('')).toBe('quote-card-quote.png');
    });
});
