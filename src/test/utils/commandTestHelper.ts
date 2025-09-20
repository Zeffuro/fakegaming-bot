import {jest} from '@jest/globals';
import {autoMockManager} from '../factories/autoMockManager.js';
import {ChatInputCommandInteraction} from 'discord.js';

interface CommandTestOptions {
    managerClass: new (...args: any[]) => any;
    managerKey: string;
    commandPath: string;
    mocks?: Array<{ module: string, factory: () => any }>;
}

export async function setupCommandTest({
                                           managerClass,
                                           managerKey,
                                           commandPath,
                                           mocks = [],
                                       }: CommandTestOptions) {
    const mockManager = autoMockManager(managerClass);

    jest.unstable_mockModule('../../config/configManagerSingleton.js', () => ({
        configManager: {
            [managerKey]: mockManager,
        },
    }));

    // Always mock permissions
    jest.unstable_mockModule('../../utils/permissions.js', () => ({
        requireAdmin: jest.fn(() => Promise.resolve(true)) as any,
    }));

    // Apply any additional mocks
    for (const {module, factory} of mocks) {
        jest.unstable_mockModule(module, factory);
    }

    const {configManager} = await import('../../config/configManagerSingleton.js');
    const command = (await import(commandPath)).default;

    return {configManager, command, mockManager};
}