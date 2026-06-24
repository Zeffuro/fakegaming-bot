import { describe, expect, it } from 'vitest';
import { createCsvFilename, serializeCsv } from '@/lib/csvExport';

describe('csv export helpers', () => {
    it('serializes headers and rows with CSV escaping', () => {
        expect(serializeCsv(
            ['name', 'note'],
            [
                ['Twitch', 'plain'],
                ['YouTube', 'contains, comma'],
                ['Bluesky', 'contains "quote"'],
                ['TikTok', 'line\nbreak'],
            ],
        )).toBe([
            'name,note',
            'Twitch,plain',
            'YouTube,"contains, comma"',
            'Bluesky,"contains ""quote"""',
            'TikTok,"line\nbreak"',
            '',
        ].join('\r\n'));
    });

    it('neutralizes spreadsheet formula-looking strings', () => {
        expect(serializeCsv(['value'], [['=cmd'], [' +SUM(A1:A2)']])).toBe("value\r\n'=cmd\r\n' +SUM(A1:A2)\r\n");
    });

    it('creates safe dated filenames', () => {
        expect(createCsvFilename('Guild 123 Analytics', new Date('2026-06-24T10:00:00.000Z'))).toBe('guild-123-analytics-2026-06-24.csv');
        expect(createCsvFilename('   ', new Date('2026-06-24T10:00:00.000Z'))).toBe('export-2026-06-24.csv');
    });
});
