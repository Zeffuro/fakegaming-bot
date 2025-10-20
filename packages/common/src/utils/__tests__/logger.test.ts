import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChildLogger, getLogger, setLoggerLevel } from '../logger.js';

const ORIGINAL_ENV = { ...process.env };

describe('logger', () => {
    beforeEach(() => {
        // Ensure pretty mode is disabled in tests
        process.env.LOG_PRETTY = '0';
        process.env.NODE_ENV = 'test';
        process.env.NEXT_RUNTIME = '';
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    it('returns a singleton logger and creates named child', () => {
        const root = getLogger();
        const again = getLogger();
        expect(again).toBe(root);

        const child = getLogger({ name: 'unit' });
        // Pino child has bindings; we can assert it has the child method interface
        expect(typeof (child as any).child).toBe('function');
    });

    it('createChildLogger attaches name and respects setLoggerLevel', () => {
        const l1 = createChildLogger('svc', { ctx: 1 });
        expect(typeof (l1 as any).info).toBe('function');

        setLoggerLevel('error');
        // pino exposes level value as string
        const rootAny = getLogger() as any;
        expect(rootAny.level).toBe('error');
    });
});
