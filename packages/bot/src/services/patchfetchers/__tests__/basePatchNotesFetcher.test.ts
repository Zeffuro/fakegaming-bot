import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BasePatchNotesFetcher } from '../basePatchNotesFetcher.js';
import { PatchNoteConfig } from '@zeffuro/fakegaming-common/models';
import axios from 'axios';

vi.mock('axios');

class TestPatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('TestGame', 0xFF5733);
    }

    getPatchNotesUrl(): string {
        return 'https://example.com/patch-notes';
    }

    parsePatchNotes(raw: any): PatchNoteConfig | null {
        if (!raw || !raw.title) return null;
        return {
            game: this.game,
            title: raw.title,
            version: raw.version,
            content: raw.content,
            url: raw.url,
            publishedAt: new Date(raw.publishedAt).getTime(),
        } as unknown as PatchNoteConfig;
    }
}

describe('BasePatchNotesFetcher', () => {
    let fetcher: TestPatchNotesFetcher;

    beforeEach(() => {
        vi.clearAllMocks();
        fetcher = new TestPatchNotesFetcher();
    });

    describe('constructor', () => {
        it('should initialize with game name and accent color', () => {
            expect(fetcher.game).toBe('TestGame');
            expect((fetcher as any).accentColor).toBe(0xFF5733);
        });
    });

    describe('getPatchNotesUrls', () => {
        it('should return single URL by default', () => {
            const urls = fetcher.getPatchNotesUrls();
            expect(urls).toEqual(['https://example.com/patch-notes']);
        });
    });

    describe('fetchRawData', () => {
        it('should fetch data from patch notes URL', async () => {
            const mockData = { title: 'Patch 1.0', content: 'Test content' };
            vi.mocked(axios.get).mockResolvedValue({ data: mockData });

            const result = await fetcher.fetchRawData();

            expect(axios.get).toHaveBeenCalledWith('https://example.com/patch-notes');
            expect(result).toEqual([mockData]);
        });

        it('should fetch from multiple URLs if overridden', async () => {
            const mockData1 = { title: 'Patch 1.0' };
            const mockData2 = { title: 'Patch 2.0' };
            vi.mocked(axios.get)
                .mockResolvedValueOnce({ data: mockData1 })
                .mockResolvedValueOnce({ data: mockData2 });

            vi.spyOn(fetcher, 'getPatchNotesUrls').mockReturnValue([
                'https://example.com/patch1',
                'https://example.com/patch2'
            ]);

            const result = await fetcher.fetchRawData();

            expect(result).toEqual([mockData1, mockData2]);
        });
    });

    describe('getThumbnailUrl', () => {
        it('should return imageUrl from patchNote by default', () => {
            const patchNote = { imageUrl: 'https://example.com/image.png' } as PatchNoteConfig;
            const url = fetcher.getThumbnailUrl({}, patchNote);
            expect(url).toBe('https://example.com/image.png');
        });

        it('should return undefined if no imageUrl', () => {
            const patchNote = {} as PatchNoteConfig;
            const url = fetcher.getThumbnailUrl({}, patchNote);
            expect(url).toBeUndefined();
        });
    });

    describe('getVersion', () => {
        it('should return version from patchNote by default', () => {
            const patchNote = { version: '1.0.0' } as PatchNoteConfig;
            const version = fetcher.getVersion({}, patchNote);
            expect(version).toBe('1.0.0');
        });

        it('should return undefined if no version', () => {
            const patchNote = {} as PatchNoteConfig;
            const version = fetcher.getVersion({}, patchNote);
            expect(version).toBeUndefined();
        });
    });

    describe('enrichPatchNote', () => {
        it('should enrich patch note with additional fields', () => {
            const raw = {};
            const patchNote = {
                game: 'TestGame',
                title: 'Patch 1.0',
                content: 'Test',
                url: 'https://example.com/patch',
                publishedAt: Date.now(),
            } as unknown as PatchNoteConfig;

            const enriched = (fetcher as any).enrichPatchNote(raw, patchNote);

            expect(enriched.accentColor).toBe(0xFF5733);
            expect(enriched.game).toBe('TestGame');
            expect(enriched.title).toBe('Patch 1.0');
        });

        it('should preserve existing fields', () => {
            const raw = {};
            const patchNote = {
                game: 'TestGame',
                title: 'Patch 1.0',
                version: '1.0.0',
                imageUrl: 'https://example.com/image.png',
                content: 'Test',
                url: 'https://example.com/patch',
                publishedAt: Date.now(),
            } as unknown as PatchNoteConfig;

            const enriched = (fetcher as any).enrichPatchNote(raw, patchNote);

            expect(enriched.version).toBe('1.0.0');
            expect(enriched.imageUrl).toBe('https://example.com/image.png');
        });
    });

    describe('compareVersions', () => {
        it('should return true if first version is less than second', () => {
            expect((fetcher as any).compareVersions('1.0', '2.0')).toBe(true);
            expect((fetcher as any).compareVersions('1.5', '1.6')).toBe(true);
        });

        it('should return false if first version is greater than or equal to second', () => {
            expect((fetcher as any).compareVersions('2.0', '1.0')).toBe(false);
            expect((fetcher as any).compareVersions('1.5', '1.5')).toBe(false);
        });

        it('should return true if either version is undefined', () => {
            expect((fetcher as any).compareVersions(undefined, '1.0')).toBe(true);
            expect((fetcher as any).compareVersions('1.0', undefined)).toBe(true);
            expect((fetcher as any).compareVersions(undefined, undefined)).toBe(true);
        });
    });
});
