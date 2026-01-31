import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('simpleColorLogger', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    describe('createSimpleLogger', () => {
        it('should create logger with all log methods', async () => {
            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            expect(logger.info).toBeDefined();
            expect(logger.warn).toBeDefined();
            expect(logger.error).toBeDefined();
            expect(logger.debug).toBeDefined();
            expect(logger.trace).toBeDefined();
        });

        it('should log info messages', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'info';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.info({ data: 'test' }, 'test message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should log warn messages', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'warn';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.warn({ data: 'test' }, 'warning message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should log error messages', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'error';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.error({ data: 'test' }, 'error message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should log debug messages when level is debug', async () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'debug';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.debug({ data: 'test' }, 'debug message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should log trace messages when level is trace', async () => {
            // trace may use console.log or console.debug depending on implementation
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'trace';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.trace({ data: 'test' }, 'trace message');

            // At least one should have been called
            const wasCalled = logSpy.mock.calls.length > 0 || debugSpy.mock.calls.length > 0;
            expect(wasCalled).toBe(true);
        });

        it('should not log below minimum level', async () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'error';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.debug({ data: 'test' }, 'debug message');

            expect(consoleSpy).not.toHaveBeenCalled();
        });

        it('should use info level in production by default', async () => {
            const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.NODE_ENV = 'production';
            delete process.env.LOG_LEVEL;

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.info({}, 'info msg');
            logger.debug({}, 'debug msg');

            expect(infoSpy).toHaveBeenCalled();
            expect(debugSpy).not.toHaveBeenCalled();
        });

        it('should use debug level in development by default', async () => {
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.NODE_ENV = 'development';
            delete process.env.LOG_LEVEL;

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.debug({}, 'debug msg');

            expect(debugSpy).toHaveBeenCalled();
        });
    });

    describe('pretty logging', () => {
        it('should format with colors when LOG_PRETTY=1', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            process.env.LOG_PRETTY = '1';
            process.env.LOG_LEVEL = 'info';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test-name');

            logger.info({}, 'pretty message');

            expect(consoleSpy).toHaveBeenCalled();
            // The formatted string should contain the name
            const call = consoleSpy.mock.calls[0][0] as string;
            expect(call).toContain('test-name');
        });

        it('should use expanded mode when LOG_PRETTY_MODE=expanded', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            process.env.LOG_PRETTY = '1';
            process.env.LOG_PRETTY_MODE = 'expanded';
            process.env.LOG_LEVEL = 'info';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test-name');

            logger.info({}, 'expanded message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should use short mode by default', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            process.env.LOG_PRETTY = '1';
            delete process.env.LOG_PRETTY_MODE;
            process.env.LOG_LEVEL = 'info';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test-name');

            logger.info({}, 'short message');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should log without object parameter', async () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'info';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            logger.info(undefined, 'message only');

            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should handle invalid LOG_LEVEL gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
            process.env.LOG_LEVEL = 'invalid_level';

            const { createSimpleLogger } = await import('../simpleColorLogger.js');
            const logger = createSimpleLogger('test');

            // Should default to debug
            logger.debug({}, 'should work');

            expect(consoleSpy).toHaveBeenCalled();
        });
    });
});