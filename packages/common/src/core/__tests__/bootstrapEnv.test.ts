/**
 * Tests for bootstrapEnv.ts environment initialization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapEnv } from '../bootstrapEnv.js';

// Mock dependencies - use vi.hoisted to ensure proper initialization order
const { configMockFn } = vi.hoisted(() => ({
    configMockFn: vi.fn<() => { parsed?: Record<string, string>; error?: Error }>(
        () => ({ parsed: { KEY: 'value' }, error: undefined })
    )
}));

vi.mock('dotenv', () => ({
    default: { config: configMockFn },
    config: configMockFn
}));

vi.mock('dotenv-expand', () => ({
    default: { expand: vi.fn() },
    expand: vi.fn()
}));

vi.mock('path', () => ({
    default: {
        resolve: vi.fn((...args: string[]) => args.join('/')),
        dirname: vi.fn(() => '/mock/dir')
    },
    resolve: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn(() => '/mock/dir')
}));

vi.mock('url', () => ({
    fileURLToPath: vi.fn(() => '/mock/file.js')
}));

describe('bootstrapEnv', () => {
    beforeEach(() => {
        configMockFn.mockClear();
        configMockFn.mockReturnValue({ parsed: { KEY: 'value' }, error: undefined });
        process.env.NODE_ENV = '';
    });

    it('should resolve paths and load default .env', () => {
        const result = bootstrapEnv('mockMetaUrl');
        expect(result.__filename).toBe('/mock/file.js');
        expect(result.__dirname).toBe('/mock/dir');
    });

    it('should load .env.development for development env', () => {
        process.env.NODE_ENV = 'development';
        const result = bootstrapEnv('mockMetaUrl');
        expect(result.__filename).toBe('/mock/file.js');
        expect(result.__dirname).toBe('/mock/dir');
    });

    it('should load .env.production for production env', () => {
        process.env.NODE_ENV = 'production';
        const result = bootstrapEnv('mockMetaUrl');
        expect(result.__filename).toBe('/mock/file.js');
        expect(result.__dirname).toBe('/mock/dir');
    });

    it('should fallback to .env if specific file is missing', () => {
        configMockFn.mockReturnValueOnce({ error: new Error('not found'), parsed: undefined });
        configMockFn.mockReturnValueOnce({ parsed: { KEY: 'value' }, error: undefined });
        const result = bootstrapEnv('mockMetaUrl');
        expect(result.__filename).toBe('/mock/file.js');
        expect(result.__dirname).toBe('/mock/dir');
    });
});
