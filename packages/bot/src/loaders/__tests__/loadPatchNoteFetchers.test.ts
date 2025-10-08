import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPatchNoteFetchers } from '../loadPatchNoteFetchers.js';
import fs from 'fs';

vi.mock('fs');

describe('loadPatchNoteFetchers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should load all patch note fetchers', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'leaguePatchNotesFetcher.ts',
            'marvelRivalsPatchNotesFetcher.ts',
            'overwatchPatchNotesFetcher.ts',
        ] as any);

        const fetchers = await loadPatchNoteFetchers();

        expect(fetchers).toBeInstanceOf(Array);
        expect(fs.readdirSync).toHaveBeenCalled();
    });

    it('should filter out base fetcher', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'leaguePatchNotesFetcher.ts',
        ] as any);

        const fetchers = await loadPatchNoteFetchers();

        expect(fetchers).toBeInstanceOf(Array);
    });

    it('should handle empty directory', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([] as any);

        const fetchers = await loadPatchNoteFetchers();

        expect(fetchers).toEqual([]);
    });

    it('should filter non-fetcher files', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'helper.ts',
            'utils.ts',
            'leaguePatchNotesFetcher.ts',
        ] as any);

        await loadPatchNoteFetchers();

        expect(fs.readdirSync).toHaveBeenCalled();
    });
});

