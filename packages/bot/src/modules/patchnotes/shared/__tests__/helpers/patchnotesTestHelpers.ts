import { setupCommandTest, createMockAutocompleteInteraction } from '@zeffuro/fakegaming-common/testing';
import { vi, expect } from 'vitest';

/**
 * Runs a smoke test for a command's autocomplete by mocking the shared gameAutocomplete,
 * invoking command.autocomplete, and asserting the mock was called.
 */
export async function runAutocompleteSmokeTest(commandPath: string, focused: string) {
    // Note: vi.mock is hoisted; don't use a variable for the module path here.
    vi.mock('../../gameAutocomplete.js', () => ({
        gameAutocomplete: vi.fn()
    }));

    const MODULE_PATH = '../../gameAutocomplete.js' as const;
    const { gameAutocomplete } = await import(MODULE_PATH);

    const { command } = await setupCommandTest(commandPath, {});
    const mockAutocompleteInteraction = createMockAutocompleteInteraction({ focused });

    await command.autocomplete(mockAutocompleteInteraction as unknown as { respond: (choices: unknown) => Promise<void> });

    expect(gameAutocomplete).toHaveBeenCalledWith(mockAutocompleteInteraction);
}
