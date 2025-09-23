import {jest} from '@jest/globals';

export function autoMockManager<T extends object>(ManagerClass: new (..._args: any[]) => T): jest.Mocked<T> {
    const mock: Partial<Record<string, any>> = {};
    let prototype = ManagerClass.prototype;
    while (prototype && prototype !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(prototype)) {
            if (key === 'constructor') continue;
            if (typeof prototype[key] === 'function' && !(key in mock)) {
                mock[key] = jest.fn();
            }
        }
        prototype = Object.getPrototypeOf(prototype);
    }
    return mock as jest.Mocked<T>;
}