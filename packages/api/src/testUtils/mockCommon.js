// Mock implementation of the common package for tests
const actualModule = require('@zeffuro/fakegaming-common');

// Mock cacheGet to return test guild data
const mockCacheGet = async (key) => {
    // Return test guild data for user guild cache keys
    if (key.includes(':guilds')) {
        return ['testguild1', 'testguild2'];
    }
    return null;
};

module.exports = {
    ...actualModule,
    cacheGet: mockCacheGet
};
