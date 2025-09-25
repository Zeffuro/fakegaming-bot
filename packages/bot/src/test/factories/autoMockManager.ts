import {jest} from '@jest/globals';

const managerExtraMethods: Record<string, string[]> = {
    ReminderManager: ['add'],
    TwitchManager: ['add', 'getAll', 'exists'],
    YoutubeManager: ['add', 'addVideoChannel', 'getVideoChannel'],
    QuoteManager: ['add'],
    BirthdayManager: ['add', 'hasBirthday'],
};

/**
 * Creates a mock manager with all prototype methods, extra known methods, and optional overrides.
 * @param managerClass The manager class to mock
 * @param overrides Optional: Record of method names to custom jest.Mock implementations
 * @returns Record<string, jest.Mock>
 */
export function autoMockManager(
    managerClass: new (...args: unknown[]) => object,
    overrides?: Record<string, jest.Mock>
) {
    const methods = new Set(
        Object.getOwnPropertyNames(managerClass.prototype)
            .filter(m => m !== 'constructor')
    );
    // Add extra known methods for this manager
    const extra = managerExtraMethods[managerClass.name] || [];
    for (const m of extra) methods.add(m);
    // Add any override methods not already present
    if (overrides) {
        for (const m of Object.keys(overrides)) methods.add(m);
    }
    const mock: Record<string, jest.Mock> = {};
    for (const method of methods) {
        mock[method] = overrides?.[method] ?? jest.fn();
    }
    return mock;
}

/**
 * Helper to create a mock manager with a set of named methods (all jest.fn by default).
 * @param methodNames Array of method names to mock
 * @param overrides Optional: Record of method names to custom jest.Mock implementations
 * @returns Record<string, jest.Mock>
 */
autoMockManager.withMethods = function (methodNames: string[], overrides?: Record<string, jest.Mock>) {
    const mock: Record<string, jest.Mock> = {};
    for (const method of methodNames) {
        mock[method] = overrides?.[method] ?? jest.fn();
    }
    return mock;
};
