import {jest} from '@jest/globals';

// Mock implementation for cacheGet during tests
export const mockCacheGet = jest.fn((_key: string): Promise<string[]> => Promise.resolve(['testguild1', 'testguild2']));

// Default mock implementation that returns test guild access
mockCacheGet.mockResolvedValue(['testguild1', 'testguild2']);

// Mock the cacheGet function from the common package
jest.unstable_mockModule('@zeffuro/fakegaming-common', async () => {
    const actualModule = await import('@zeffuro/fakegaming-common');
    return {
        ...actualModule,
        cacheGet: mockCacheGet
    };
});

export function resetCacheMocks() {
    mockCacheGet.mockReset();
    mockCacheGet.mockResolvedValue(['testguild1', 'testguild2']);
}
