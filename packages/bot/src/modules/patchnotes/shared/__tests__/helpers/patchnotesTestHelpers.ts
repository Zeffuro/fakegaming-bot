import { setupCommandTest, createMockAutocompleteInteraction } from '@zeffuro/fakegaming-common/testing';
import { vi, expect } from 'vitest';
import path from 'node:path';
import { PROJECT_ROOT } from '@zeffuro/fakegaming-common';

/**
 * Runs a smoke test for a command's autocomplete by mocking the shared gameAutocomplete,
 * invoking command.autocomplete, and asserting the mock was called.
 */
export async function runAutocompleteSmokeTest(commandPath: string, focused: string) {
    // Fully isolate module cache for this test, so the command picks up our mock
    vi.resetModules();

    const absoluteGamePath = path.join(PROJECT_ROOT, 'packages', 'bot', 'src', 'modules', 'patchnotes', 'shared', 'gameAutocomplete.js');

    // Mock the gameAutocomplete module by absolute path
    vi.doMock(absoluteGamePath, () => ({
        gameAutocomplete: vi.fn()
    }));

    // Import the mocked module to get the spy instance
    const { gameAutocomplete } = await import(absoluteGamePath);

    // Now import the command through the normal helper; it will bind to the mocked module
    const { command } = await setupCommandTest(commandPath, {});
    const mockAutocompleteInteraction = createMockAutocompleteInteraction({ focused });

    await command.autocomplete(mockAutocompleteInteraction as unknown as { respond: (choices: unknown) => Promise<void> });

    expect(gameAutocomplete).toHaveBeenCalledWith(mockAutocompleteInteraction);
}
