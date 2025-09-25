import {jest} from '@jest/globals';
import {autoMockManager} from '../factories/autoMockManager.js';

interface CommandTestOptions {
    managerClass: new (..._args: unknown[]) => object;
    managerKey: string;
    commandPath: string;
    mocks?: Array<{ module: string, factory: () => object }>;
}

export async function setupCommandTest({
                                           managerClass,
                                           managerKey,
                                           commandPath,
                                           mocks = [],
                                       }: CommandTestOptions) {
    const mockManager = autoMockManager(managerClass);

    jest.unstable_mockModule('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js', () => {
        const configManager = {
            [managerKey]: mockManager,
        };
        return {
            configManager,
            getConfigManager: () => configManager,
        };
    });

    // Always mock permissions
    jest.unstable_mockModule('../../utils/permissions.js', () => ({
        requireAdmin: jest.fn(() => Promise.resolve(true)),
    }));

    // Apply any additional mocks
    for (const {module, factory} of mocks) {
        jest.unstable_mockModule(module, factory);
    }

    const configManagerModule = await import('@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js');
    const getConfigManager = configManagerModule.getConfigManager;
    const command = (await import(commandPath)).default;

    return {getConfigManager, command, mockManager};
}

/**
 * Like setupCommandTest, but also returns a preconfigured MockInteraction.
 * @param options CommandTestOptions plus interactionOptions for MockInteraction
 * @returns { getConfigManager, command, mockManager, interaction }
 */
export async function setupCommandWithInteraction({
                                                      interactionOptions = {},
                                                      ...options
                                                  }: CommandTestOptions & {
    interactionOptions?: ConstructorParameters<typeof import('../MockInteraction.js').MockInteraction>[0]
}) {
    const {getConfigManager, command, mockManager} = await setupCommandTest(options);
    const {MockInteraction} = await import('../MockInteraction.js');
    const interaction = new MockInteraction(interactionOptions);
    return {getConfigManager, command, mockManager, interaction};
}
