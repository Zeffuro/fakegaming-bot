import { describe, it, expect, vi } from 'vitest';
import { gameAutocomplete } from '../gameAutocomplete.js';
import { AutocompleteInteraction } from 'discord.js';
import * as loadPatchNoteFetchers from '../../../../loaders/loadPatchNoteFetchers.js';

vi.mock('../../../../loaders/loadPatchNoteFetchers.js');

describe('gameAutocomplete', () => {
    it('should return all games when no filter is applied', async () => {
        const mockFetchers = [
            { game: 'League of Legends' },
            { game: 'Overwatch' },
            { game: 'Marvel Rivals' },
        ];
        vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(mockFetchers as any);

        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue(''),
            },
            respond: vi.fn(),
        } as unknown as AutocompleteInteraction;

        await gameAutocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'League of Legends', value: 'League of Legends' },
            { name: 'Overwatch', value: 'Overwatch' },
            { name: 'Marvel Rivals', value: 'Marvel Rivals' },
        ]);
    });

    it('should filter games by focused value', async () => {
        const mockFetchers = [
            { game: 'League of Legends' },
            { game: 'Overwatch' },
            { game: 'Marvel Rivals' },
        ];
        vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(mockFetchers as any);

        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue('league'),
            },
            respond: vi.fn(),
        } as unknown as AutocompleteInteraction;

        await gameAutocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'League of Legends', value: 'League of Legends' },
        ]);
    });

    it('should be case-insensitive when filtering', async () => {
        const mockFetchers = [
            { game: 'League of Legends' },
            { game: 'Overwatch' },
            { game: 'Marvel Rivals' },
        ];
        vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(mockFetchers as any);

        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue('OVERWATCH'),
            },
            respond: vi.fn(),
        } as unknown as AutocompleteInteraction;

        await gameAutocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'Overwatch', value: 'Overwatch' },
        ]);
    });

    it('should return empty array when no games match', async () => {
        const mockFetchers = [
            { game: 'League of Legends' },
            { game: 'Overwatch' },
        ];
        vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(mockFetchers as any);

        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue('nonexistent'),
            },
            respond: vi.fn(),
        } as unknown as AutocompleteInteraction;

        await gameAutocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([]);
    });

    it('should match partial strings', async () => {
        const mockFetchers = [
            { game: 'League of Legends' },
            { game: 'Marvel Rivals' },
        ];
        vi.mocked(loadPatchNoteFetchers.loadPatchNoteFetchers).mockResolvedValue(mockFetchers as any);

        const interaction = {
            options: {
                getFocused: vi.fn().mockReturnValue('rival'),
            },
            respond: vi.fn(),
        } as unknown as AutocompleteInteraction;

        await gameAutocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([
            { name: 'Marvel Rivals', value: 'Marvel Rivals' },
        ]);
    });
});
