import { describe, it, expect, vi } from 'vitest';
import { gameAutocomplete } from '../gameAutocomplete.js';
import * as loadPatchNoteFetchers from '../../../../loaders/loadPatchNoteFetchers.js';
import { createMockAutocompleteInteraction } from '@zeffuro/fakegaming-common/testing';

vi.mock('../../../../loaders/loadPatchNoteFetchers.js');

// --- local DRY helpers ---
function mockFetchers(games: string[]) {
    const fetchers = games.map(g => ({ game: g }));
    vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(fetchers as any);
}

async function runAndExpect(focused: string, expectedNames: string[]) {
    const interaction = createMockAutocompleteInteraction({ focused });
    await gameAutocomplete(interaction);
    const expected = expectedNames.map(n => ({ name: n, value: n }));
    expect(interaction.respond).toHaveBeenCalledWith(expected);
}

describe('gameAutocomplete', () => {
    it('should return all games when no filter is applied', async () => {
        mockFetchers(['League of Legends', 'Overwatch', 'Marvel Rivals']);
        await runAndExpect('', ['League of Legends', 'Overwatch', 'Marvel Rivals']);
    });

    it('should filter games by focused value', async () => {
        mockFetchers(['League of Legends', 'Overwatch', 'Marvel Rivals']);
        await runAndExpect('league', ['League of Legends']);
    });

    it('should be case-insensitive when filtering', async () => {
        mockFetchers(['League of Legends', 'Overwatch', 'Marvel Rivals']);
        await runAndExpect('OVERWATCH', ['Overwatch']);
    });

    it('should return empty array when no games match', async () => {
        mockFetchers(['League of Legends', 'Overwatch']);
        await runAndExpect('nonexistent', []);
    });

    it('should match partial strings', async () => {
        mockFetchers(['League of Legends', 'Marvel Rivals']);
        await runAndExpect('rival', ['Marvel Rivals']);
    });
});
