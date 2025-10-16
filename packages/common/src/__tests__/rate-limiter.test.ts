import { describe, it, expect, vi } from 'vitest';
import { PostgresRateLimiter } from '../rate-limiter.js';

interface Row { key: string; window_ts: string; count: number }

class MockSequelize {
    public dialect: { name: string };
    private rows: Row[] = [];
    private shouldThrow: boolean;

    constructor(dialectName: string, shouldThrow = false) {
        this.dialect = { name: dialectName };
        this.shouldThrow = shouldThrow;
    }

    addRow(key: string, windowTs: Date | string, count: number): void {
        const ts = typeof windowTs === 'string' ? windowTs : windowTs.toISOString();
        this.rows.push({ key, window_ts: ts, count });
    }

    async query(sql: string, opts?: { replacements?: Record<string, unknown> }): Promise<[unknown, unknown]> {
        if (this.shouldThrow) throw new Error('DB error');
        const r = opts?.replacements ?? {};
        const key = String(r.key ?? '');
        const cost = Number(r.cost ?? 0);
        const bucketTsISO = r.bucketTs instanceof Date ? r.bucketTs.toISOString() : typeof r.bucketTs === 'string' ? r.bucketTs : undefined;
        const cutoffISO = r.cutoff instanceof Date ? r.cutoff.toISOString() : typeof r.cutoff === 'string' ? r.cutoff : undefined;

        // Normalize SQL detection by keywords
        const s = sql.toUpperCase();
        if (s.includes('UPDATE API_RATE_LIMITS SET COUNT = COUNT +')) {
            if (bucketTsISO) {
                const row = this.rows.find((x) => x.key === key && x.window_ts === bucketTsISO);
                if (row) row.count += cost;
            }
            return [[], null as unknown as unknown];
        }
        if (s.includes('INSERT OR IGNORE INTO API_RATE_LIMITS')) {
            // SQLite ignore on conflict: insert only if missing
            if (bucketTsISO) {
                const existing = this.rows.find((x) => x.key === key && x.window_ts === bucketTsISO);
                if (!existing) this.rows.push({ key, window_ts: bucketTsISO, count: cost });
            }
            return [[], null as unknown as unknown];
        }
        if (s.includes('INSERT INTO API_RATE_LIMITS')) {
            if (bucketTsISO) {
                const existing = this.rows.find((x) => x.key === key && x.window_ts === bucketTsISO);
                if (s.includes('ON CONFLICT (KEY, WINDOW_TS) DO UPDATE')) {
                    // Postgres upsert: update if exists, otherwise insert
                    if (existing) {
                        existing.count += cost;
                    } else {
                        this.rows.push({ key, window_ts: bucketTsISO, count: cost });
                    }
                } else if (s.includes('ON CONFLICT DO NOTHING')) {
                    // Generic no-op on conflict: insert only if missing
                    if (!existing) this.rows.push({ key, window_ts: bucketTsISO, count: cost });
                } else {
                    // Plain insert fallback
                    if (!existing) this.rows.push({ key, window_ts: bucketTsISO, count: cost });
                }
            }
            return [[], null as unknown as unknown];
        }
        if (s.includes('SELECT SUM(COUNT) AS TOTAL')) {
            const cutoff = cutoffISO ?? new Date(0).toISOString();
            let total = 0;
            for (const row of this.rows) {
                if (row.key === key && row.window_ts >= cutoff) total += row.count;
            }
            return [[{ total }], null as unknown as unknown];
        }
        if (s.includes('SELECT COUNT(*) AS C')) {
            const cutoff = cutoffISO ?? new Date(0).toISOString();
            let c = 0;
            for (const row of this.rows) {
                if (row.window_ts < cutoff) c++;
            }
            return [[{ c }], null as unknown as unknown];
        }
        if (s.startsWith('DELETE FROM API_RATE_LIMITS')) {
            const cutoff = cutoffISO ?? new Date(0).toISOString();
            this.rows = this.rows.filter((row) => row.window_ts >= cutoff);
            return [[], null as unknown as unknown];
        }

        throw new Error('Unhandled SQL path: ' + sql);
    }
}

describe('PostgresRateLimiter', () => {
    it('increments within window and enforces limit (postgres dialect)', async () => {
        const db = new MockSequelize('postgres');
        const limiter = new PostgresRateLimiter(db as unknown as any);
        const win = 1000;
        const limit = 5;

        const r1 = await limiter.consume('k', 2, win, limit);
        expect(r1.allowed).toBe(true);
        expect(r1.remaining).toBe(3);

        const r2 = await limiter.consume('k', 2, win, limit);
        expect(r2.allowed).toBe(true);
        expect(r2.remaining).toBe(1);

        const r3 = await limiter.consume('k', 2, win, limit);
        expect(r3.allowed).toBe(false);
        expect(r3.remaining).toBe(0);
    });

    it('behaves similarly on sqlite path', async () => {
        const db = new MockSequelize('sqlite');
        const limiter = new PostgresRateLimiter(db as unknown as any);
        const win = 500;
        const limit = 3;

        // Freeze time so all buckets fall into the same window and results are deterministic
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

        const a = await limiter.consume('s', 1, win, limit);
        expect(a.allowed).toBe(true);
        expect(a.remaining).toBe(2);

        const b = await limiter.consume('s', 2, win, limit);
        expect(b.allowed).toBe(true);
        expect(b.remaining).toBe(0);

        const c = await limiter.consume('s', 1, win, limit);
        expect(c.allowed).toBe(false);
        expect(c.remaining).toBe(0);

        vi.useRealTimers();
    });

    it('falls back to in-memory buckets when DB errors occur', async () => {
        const db = new MockSequelize('postgres', true);
        const limiter = new PostgresRateLimiter(db as unknown as any);
        const win = 200;

        const x1 = await limiter.consume('f', 3, win, 999); // limit ignored in fallback, uses 5
        expect(x1.allowed).toBe(true);
        expect(x1.limit).toBe(5);
        expect(x1.remaining).toBe(2);

        const x2 = await limiter.consume('f', 3, win, 999);
        expect(x2.allowed).toBe(false);
        expect(x2.remaining).toBe(0);
        expect(x2.limit).toBe(5);
    });

    it('cleanup removes old buckets and reports deleted count', async () => {
        const db = new MockSequelize('postgres');
        const limiter = new PostgresRateLimiter(db as unknown as any);
        const now = Date.now();
        db.addRow('k', new Date(now - 10_000), 1); // old
        db.addRow('k', new Date(now - 100), 2); // recent

        const deleted = await limiter.cleanup(1000);
        expect(deleted).toBe(1);

        const res = await limiter.consume('k', 1, 1000, 10);
        // Total should consider only recent row + this one: 2 + 1 = 3
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(7);
    });
});
