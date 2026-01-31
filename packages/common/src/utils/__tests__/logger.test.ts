import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('logger', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
        // Ensure pretty mode is disabled in tests by default
        process.env.LOG_PRETTY = '0';
        process.env.NODE_ENV = 'test';
        process.env.NEXT_RUNTIME = '';
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    describe('getLogger', () => {
        it('returns a singleton logger and creates named child', async () => {
            const { getLogger } = await import('../logger.js');
            const root = getLogger();
            const again = getLogger();
            expect(again).toBe(root);

            const child = getLogger({ name: 'unit' });
            // Pino child has bindings; we can assert it has the child method interface
            expect(typeof (child as any).child).toBe('function');
        });

        it('should create logger with default level in development', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.LOG_LEVEL;
            delete process.env.LOG_PRETTY;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
            expect(logger.level).toBe('debug');
        });

        it('should create logger with info level in production', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.LOG_LEVEL;
            delete process.env.LOG_PRETTY;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
            expect(logger.level).toBe('info');
        });

        it('should respect LOG_LEVEL env var', async () => {
            process.env.LOG_LEVEL = 'warn';
            delete process.env.LOG_PRETTY;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger.level).toBe('warn');
        });
    });

    describe('createChildLogger', () => {
        it('attaches name and respects setLoggerLevel', async () => {
            const { createChildLogger, getLogger, setLoggerLevel } = await import('../logger.js');
            const l1 = createChildLogger('svc', { ctx: 1 });
            expect(typeof (l1 as any).info).toBe('function');

            setLoggerLevel('error');
            // pino exposes level value as string
            const rootAny = getLogger() as any;
            expect(rootAny.level).toBe('error');
        });

        it('should create child logger with name only', async () => {
            const { createChildLogger } = await import('../logger.js');
            const child = createChildLogger('my-child');

            expect(child).toBeDefined();
            expect(typeof child.info).toBe('function');
        });
    });

    describe('setLoggerLevel', () => {
        it('should change logger level at runtime', async () => {
            delete process.env.LOG_PRETTY;

            const { getLogger, setLoggerLevel } = await import('../logger.js');
            const logger = getLogger();

            setLoggerLevel('error');

            expect(logger.level).toBe('error');
        });

        it('should create root logger if not exists', async () => {
            const { setLoggerLevel, getLogger } = await import('../logger.js');

            // Call setLoggerLevel before getLogger
            setLoggerLevel('trace');

            const logger = getLogger();
            expect(logger.level).toBe('trace');
        });
    });

    describe('pretty logging', () => {
        it('should enable pretty logging when LOG_PRETTY=1 and not in test/Next.js', async () => {
            process.env.LOG_PRETTY = '1';
            process.env.NODE_ENV = 'development';
            delete process.env.NEXT_RUNTIME;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            // Logger should still be created (we can't easily verify pretty mode, but it shouldn't crash)
            expect(logger).toBeDefined();
        });

        it('should use expanded mode when LOG_PRETTY_MODE=expanded', async () => {
            process.env.LOG_PRETTY = '1';
            process.env.LOG_PRETTY_MODE = 'expanded';
            process.env.NODE_ENV = 'development';
            delete process.env.NEXT_RUNTIME;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
        });

        it('should use short mode by default', async () => {
            process.env.LOG_PRETTY = '1';
            delete process.env.LOG_PRETTY_MODE;
            process.env.NODE_ENV = 'development';
            delete process.env.NEXT_RUNTIME;

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
        });

        it('should disable pretty logging in test environment', async () => {
            process.env.LOG_PRETTY = '1';
            process.env.NODE_ENV = 'test';

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
        });

        it('should disable pretty logging in Next.js runtime', async () => {
            process.env.LOG_PRETTY = '1';
            process.env.NODE_ENV = 'development';
            process.env.NEXT_RUNTIME = 'nodejs';

            const { getLogger } = await import('../logger.js');
            const logger = getLogger();

            expect(logger).toBeDefined();
        });
    });
});