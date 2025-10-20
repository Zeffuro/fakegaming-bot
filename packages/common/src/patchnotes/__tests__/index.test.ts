import { describe, it, expect } from 'vitest';
import { getDefaultPatchNoteFetchers, LeaguePatchNotesFetcher, OverwatchPatchNotesFetcher, MarvelRivalsPatchNotesFetcher } from '../index.js';

describe('patchnotes index', () => {
    it('getDefaultPatchNoteFetchers returns instances of known fetchers', () => {
        const list = getDefaultPatchNoteFetchers();
        expect(list.length).toBe(3);
        expect(list[0]).toBeInstanceOf(LeaguePatchNotesFetcher);
        expect(list[1]).toBeInstanceOf(MarvelRivalsPatchNotesFetcher);
        expect(list[2]).toBeInstanceOf(OverwatchPatchNotesFetcher);
    });
});

