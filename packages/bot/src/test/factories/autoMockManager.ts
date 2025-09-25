import {jest} from '@jest/globals';

const managerExtraMethods: Record<string, string[]> = {
    ReminderManager: ['add'],
    TwitchManager: ['add', 'getAll', 'exists'],
    YoutubeManager: ['add', 'addVideoChannel', 'getVideoChannel'],
    QuoteManager: ['add'],
    BirthdayManager: ['add', 'hasBirthday'],
};

export function autoMockManager(managerClass: new (...args: unknown[]) => object) {
    const methods = new Set(
        Object.getOwnPropertyNames(managerClass.prototype)
            .filter(m => m !== 'constructor')
    );
    // Add extra known methods for this manager
    const extra = managerExtraMethods[managerClass.name] || [];
    for (const m of extra) methods.add(m);

    const mock: Record<string, jest.Mock> = {};
    for (const method of methods) {
        mock[method] = jest.fn();
    }
    return mock;
}