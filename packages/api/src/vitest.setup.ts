import { beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

// Set up test environment variables
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.JWT_AUDIENCE = 'fakegaming-dashboard';
process.env.JWT_ISSUER = 'fakegaming-test';

// Choose a per-worker on-disk SQLite file (no template/locks). This avoids shared-state issues and extra .env.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resolveRepoRoot(): string {
    // Try walking up to find pnpm-workspace.yaml as repo root marker
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
        const next = path.dirname(dir);
        if (next === dir) break;
        dir = next;
    }
    // Fallback to two levels up (../../)
    return path.resolve(process.cwd(), '..', '..');
}

const repoRoot = resolveRepoRoot();
const dataDir = path.join(repoRoot, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
// Prefer OS temp for test DBs (more reliable on CI); e.g., .../fakegaming-bot-tests/api
const ciTmp = process.env.RUNNER_TEMP || os.tmpdir();
const testDbDir = path.join(ciTmp, 'fakegaming-bot-tests', 'api');
if (!fs.existsSync(testDbDir)) {
    try { fs.mkdirSync(testDbDir, { recursive: true }); } catch { /* noop */ }
}

function dirIsWritable(dir: string): boolean {
    try {
        const probe = path.join(dir, `.probe-${process.pid}-${Date.now()}`);
        fs.writeFileSync(probe, 'ok');
        fs.unlinkSync(probe);
        return true;
    } catch {
        return false;
    }
}

// Ensure common's resolveDataRoot() points to repoRoot/data (avoid packages/api/data)
process.env.DATA_ROOT = path.relative(repoRoot, dataDir) || 'data';

function makeWorkerDbPath(): string {
    const unique = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    return path.join(testDbDir, `_api_test.${unique}.sqlite`);
}

function cleanupOldTestDbs(opts?: { aggressive?: boolean }): void {
    const aggressive = opts?.aggressive === true;
    const ttlMs = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();
    const dirs = [testDbDir];

    function tryUnlinkWithSiblings(baseFile: string): void {
        const siblings = [
            baseFile,
            `${baseFile}-wal`,
            `${baseFile}-shm`,
            `${baseFile}-journal`,
        ];
        for (const f of siblings) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* noop */ }
        }
    }

    for (const dir of dirs) {
        try {
            if (!fs.existsSync(dir)) continue;
            const entries = fs.readdirSync(dir);
            let matchCount = 0;
            for (const name of entries) {
                if (!(name.startsWith('_api_test.') && name.endsWith('.sqlite'))) continue;
                matchCount++;
                const full = path.join(dir, name);
                if (aggressive) {
                    tryUnlinkWithSiblings(full);
                    continue;
                }
                try {
                    const stat = fs.statSync(full);
                    if ((now - stat.mtimeMs) > ttlMs) {
                        tryUnlinkWithSiblings(full);
                    }
                } catch { /* noop */ }
            }
            // If too many files remain, attempt a second-pass aggressive cleanup
            if (!aggressive && matchCount > 20) {
                for (const name of entries) {
                    if (!(name.startsWith('_api_test.') && name.endsWith('.sqlite'))) continue;
                    const full = path.join(dir, name);
                    tryUnlinkWithSiblings(full);
                }
            }
        } catch { /* noop */ }
    }
}

// Mock the defaultCacheManager to use our shared in-memory test cache
vi.mock('@zeffuro/fakegaming-common', async () => {
    const actual = await vi.importActual<any>('@zeffuro/fakegaming-common');

    class InMemoryCacheManager {
        private cache = new Map<string, { value: any; expiry: number }>();
        async get<T>(key: string): Promise<T | null> {
            const item = this.cache.get(key);
            if (!item) return null;
            if (Date.now() > item.expiry) { this.cache.delete(key); return null; }
            return item.value as T;
        }
        async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
            this.cache.set(key, { value, expiry: Date.now() + ttlMs });
        }
        async del(key: string): Promise<void> { this.cache.delete(key); }
        async getCachedData<T>(key: string, fetchFn: () => Promise<T>, ttlMs: number): Promise<T | null> {
            const cached = await this.get<T>(key);
            if (cached) return cached;
            const fresh = await fetchFn();
            if (fresh) { await this.set(key, fresh, ttlMs); }
            return fresh;
        }
        async clearUserCache(userId: string): Promise<void> {
            await this.del(actual.CACHE_KEYS.userProfile(userId));
            await this.del(actual.CACHE_KEYS.userGuilds(userId));
            await this.del(actual.CACHE_KEYS.userAccessToken(userId));
        }
        clear(): void { this.cache.clear(); }
    }

    const mockCache = new InMemoryCacheManager();
    (globalThis as any).__testCacheManager = mockCache;

    return {
        ...actual,
        defaultCacheManager: mockCache,
        PostgresRateLimiter: actual.PostgresRateLimiter,
    };
});

// Now import from the mocked module
import { getConfigManager, closeSequelize, CACHE_KEYS, CACHE_TTL, MinimalGuildData } from '@zeffuro/fakegaming-common';

const TEST_GUILDS: MinimalGuildData[] = [
    { id: 'testguild1', permissions: '8' },
    { id: 'testguild2', permissions: '8' },
    { id: 'testguild3', permissions: '8' },
    { id: 'birthdayguild1', permissions: '8' },
    { id: 'birthdayguild2', permissions: '8' },
    { id: 'birthdayguild3', permissions: '8' },
    { id: 'jwtguild', permissions: '8' },
    { id: 'testserver1', permissions: '8' }
];

export const configManager = getConfigManager();

beforeAll(async () => {
    const g = globalThis as any;

    // Proactively clean up stale DB files from previous runs
    if (process.env.CI === 'true') {
        cleanupOldTestDbs(); // TTL-based on CI
    } else {
        cleanupOldTestDbs({ aggressive: true }); // delete anything not locked locally
    }

    const preferMemory = process.env.CI === 'true' || !dirIsWritable(testDbDir);
    process.env.FAKEGAMING_TEST_DB_MODE = preferMemory ? 'memory' : 'file';

    // Reuse a single worker DB path across files in the same worker (only when using file mode)
    if (!preferMemory && !process.env.TEST_SQLITE_FILE) {
        process.env.TEST_SQLITE_FILE = makeWorkerDbPath();
        // Best-effort: create/touch file to ensure directory is writable
        try { fs.writeFileSync(process.env.TEST_SQLITE_FILE, '', { flag: 'a' }); } catch { /* noop */ }
    } else if (preferMemory) {
        // Ensure we don't accidentally reuse an old path
        delete process.env.TEST_SQLITE_FILE;
    }

    // Ensure only one init runs per worker by using a shared promise
    if (!g.__API_DB_READY_PROMISE__) {
        g.__API_DB_READY_PROMISE__ = (async () => {
            const workerDb = process.env.TEST_SQLITE_FILE;
            try {
                await configManager.init(true);
            } catch (err) {
                // Log a small hint to help debug CI readonly issues
                try {
                    const st = workerDb && fs.existsSync(workerDb) ? fs.statSync(workerDb) : null;
                    const msg = `[api-tests] init failed dbMode=${process.env.FAKEGAMING_TEST_DB_MODE} path=${workerDb || ':memory:'} exists=${!!st} size=${st ? st.size : 'n/a'}`;
                    console.error(msg);
                } catch { /* noop */ }
                try { await closeSequelize(); } catch { /* noop */ }
                if (!preferMemory && workerDb) {
                    try { if (fs.existsSync(workerDb)) fs.unlinkSync(workerDb); } catch { /* noop */ }
                    // Create a fresh path and retry once
                    try { fs.mkdirSync(path.dirname(workerDb), { recursive: true }); } catch { /* noop */ }
                    try { fs.writeFileSync(workerDb, '', { flag: 'a' }); } catch { /* noop */ }
                }
                await configManager.init(true);
            }
            g.__API_DB_READY__ = true;

            // Register a one-time process exit cleanup for this worker
            if (!g.__API_DB_CLEANUP_REGISTERED__) {
                g.__API_DB_CLEANUP_REGISTERED__ = true;
                const cleanup = async () => {
                    try { await closeSequelize(); } catch { /* noop */ }
                    if (!preferMemory) {
                        try {
                            const p = process.env.TEST_SQLITE_FILE;
                            if (p && fs.existsSync(p)) fs.unlinkSync(p);
                        } catch { /* noop */ }
                    }
                    // Final pass to tidy up any orphaned files
                    try {
                        if (process.env.CI === 'true') cleanupOldTestDbs(); else cleanupOldTestDbs({ aggressive: true });
                    } catch { /* noop */ }
                };
                process.once('exit', () => { void cleanup(); });
                process.once('SIGINT', () => { void cleanup(); process.exit(0); });
            }
        })();
    }

    // Wait for the shared initialization to complete
    await g.__API_DB_READY_PROMISE__;
}, 180000);

// Remove per-file afterAll cleanup to avoid closing the DB while other files are still running
// Cleanup is handled by the process exit hook above.

beforeEach(async () => {
    const testCache = (globalThis as any).__testCacheManager;
    if (testCache && typeof testCache.clear === 'function') {
        testCache.clear();
    }
    if (testCache) {
        await testCache.set(CACHE_KEYS.userGuilds('testuser'), TEST_GUILDS, CACHE_TTL.USER_GUILDS);
    }
});

afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
});

// Final per-worker cleanup once all tests in this worker finish
async function unlinkWithRetries(baseFile: string): Promise<void> {
    const siblings = [baseFile, `${baseFile}-wal`, `${baseFile}-shm`, `${baseFile}-journal`];
    const retries = 3;
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    for (let attempt = 0; attempt < retries; attempt++) {
        let allGone = true;
        for (const f of siblings) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { allGone = false; }
        }
        if (allGone) return;
        await delay(100 * (attempt + 1));
    }
}

afterAll(async () => {
    const preferMemory = process.env.FAKEGAMING_TEST_DB_MODE === 'memory';
    try { await closeSequelize(); } catch { /* noop */ }
    if (!preferMemory) {
        const p = process.env.TEST_SQLITE_FILE;
        if (p) {
            try { await unlinkWithRetries(p); } catch { /* noop */ }
        }
    }
    // Now that connections are closed, aggressively clean leftover test DBs
    try {
        if (process.env.CI === 'true') cleanupOldTestDbs(); else cleanupOldTestDbs({ aggressive: true });
    } catch { /* noop */ }
});
