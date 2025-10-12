import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPatchNoteFetchers, type DynamicImporter } from '../loadPatchNoteFetchers.js';
import fs from 'fs';

vi.mock('fs');

describe('loadPatchNoteFetchers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function createStubImporter(_filesToExportName?: Record<string, string>): DynamicImporter {
        return async (_url: string) => {
            // Always return a module object with at least one class-like export that has getPatchNotesUrl
            // The loader inspects prototype.getPatchNotesUrl to detect fetcher classes.
            class StubFetcher {
                getPatchNotesUrl(): string { return 'https://example.com/patch'; }
            }
            return {
                // The key name is irrelevant; loader scans values
                StubFetcher,
            } as unknown as Record<string, unknown>;
        };
    }

    it('should load all patch note fetchers', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'leaguePatchNotesFetcher.ts',
            'marvelRivalsPatchNotesFetcher.ts',
            'overwatchPatchNotesFetcher.ts',
        ] as any);

        const fetchers = await loadPatchNoteFetchers(createStubImporter());

        expect(Array.isArray(fetchers)).toBe(true);
        // 3 concrete fetchers, base excluded
        expect(fetchers.length).toBe(3);
        expect(fs.readdirSync).toHaveBeenCalled();
    });

    it('should filter out base fetcher', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'leaguePatchNotesFetcher.ts',
        ] as any);

        const fetchers = await loadPatchNoteFetchers(createStubImporter());

        expect(Array.isArray(fetchers)).toBe(true);
        expect(fetchers.length).toBe(1);
    });

    it('should handle empty directory', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([] as any);

        const fetchers = await loadPatchNoteFetchers(createStubImporter());

        expect(fetchers).toEqual([]);
    });

    it('should filter non-fetcher files', async () => {
        vi.mocked(fs.readdirSync).mockReturnValue([
            'basePatchNotesFetcher.ts',
            'helper.ts',
            'utils.ts',
            'leaguePatchNotesFetcher.ts',
        ] as any);

        const fetchers = await loadPatchNoteFetchers(createStubImporter());

        // Only one .*(Fetcher).ts other than base
        expect(fetchers.length).toBe(1);
        expect(fs.readdirSync).toHaveBeenCalled();
    });
});
