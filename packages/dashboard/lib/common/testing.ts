// Local testing wrapper to avoid pulling in API/express from shared testing index.
// Re-export only the helpers we need for dashboard unit tests via stable package subpaths.
export { withCacheMocks, mockCacheGet } from '@zeffuro/fakegaming-common/testing/mocks/cache';
export { signTestJwt } from '@zeffuro/fakegaming-common/testing/utils/jwt';
