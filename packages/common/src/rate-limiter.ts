import type { Sequelize } from 'sequelize-typescript';

export interface RateLimiterResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
}

export interface RateLimiter {
    consume(key: string, cost: number, windowMs: number, limit: number): Promise<RateLimiterResult>;
}

interface FallbackEntry { count: number; expires: number; }

/**
 * Postgres/SQL-backed sliding window rate limiter using a per-second bucket table.
 * Falls back to a tiny in-memory bucket (max 5) if DB errors occur.
 */
export class PostgresRateLimiter implements RateLimiter {
    private sequelize: Sequelize;
    private fallback: Map<string, FallbackEntry> = new Map();

    constructor(sequelize: Sequelize) {
        this.sequelize = sequelize;
    }

    /**
     * Remove expired bucket rows older than the provided retention (in ms).
     * Returns number of deleted rows (best-effort across dialects).
     * Intended to be called on a low-frequency interval (e.g., every 60s).
     */
    async cleanup(retentionMs: number): Promise<number> {
        const dialect = (this.sequelize as any).dialect?.name || 'postgres';
        const cutoffDate = new Date(Date.now() - retentionMs);
        const cutoffParam = dialect === 'sqlite' ? cutoffDate.toISOString() : cutoffDate;
        // Count then delete (works across sqlite/postgres generically)
        const [countRows] = await this.sequelize.query(
            'SELECT COUNT(*) as c FROM api_rate_limits WHERE window_ts < :cutoff',
            { replacements: { cutoff: cutoffParam } }
        );
        const toDelete = Number((countRows as any[])[0]?.c || 0);
        if (toDelete > 0) {
            await this.sequelize.query(
                'DELETE FROM api_rate_limits WHERE window_ts < :cutoff',
                { replacements: { cutoff: cutoffParam } }
            );
        }
        return toDelete;
    }

    async consume(key: string, cost: number, windowMs: number, limit: number): Promise<RateLimiterResult> {
        const now = Date.now();
        const bucketDate = new Date(Math.floor(now / 1000) * 1000); // truncate to second
        const cutoffDate = new Date(now - windowMs);
        const dialect = (this.sequelize as any).dialect?.name || 'postgres';
        const bucketParam = dialect === 'sqlite' ? bucketDate.toISOString() : bucketDate;
        const cutoffParam = dialect === 'sqlite' ? cutoffDate.toISOString() : cutoffDate;
        try {
            // Upsert logic tailored per dialect
            if (dialect === 'postgres') {
                await this.sequelize.query(
                    'INSERT INTO api_rate_limits (key, window_ts, count) VALUES (:key, :bucketTs, :cost) ON CONFLICT (key, window_ts) DO UPDATE SET count = api_rate_limits.count + :cost',
                    { replacements: { key, bucketTs: bucketParam, cost } }
                );
            } else if (dialect === 'sqlite') {
                // Update first; then insert or ignore if row absent
                await this.sequelize.query(
                    'UPDATE api_rate_limits SET count = count + :cost WHERE key = :key AND window_ts = :bucketTs',
                    { replacements: { key, bucketTs: bucketParam, cost } }
                );
                await this.sequelize.query(
                    'INSERT OR IGNORE INTO api_rate_limits (key, window_ts, count) VALUES (:key, :bucketTs, :cost)',
                    { replacements: { key, bucketTs: bucketParam, cost } }
                );
            } else {
                // Generic fallback: try update then insert with ON CONFLICT DO NOTHING (may work on some dialects)
                await this.sequelize.query(
                    'UPDATE api_rate_limits SET count = count + :cost WHERE key = :key AND window_ts = :bucketTs',
                    { replacements: { key, bucketTs: bucketParam, cost } }
                );
                await this.sequelize.query(
                    'INSERT INTO api_rate_limits (key, window_ts, count) VALUES (:key, :bucketTs, :cost) ON CONFLICT DO NOTHING',
                    { replacements: { key, bucketTs: bucketParam, cost } }
                );
            }

            // Sum counts in sliding window
            const [rows] = await this.sequelize.query(
                'SELECT SUM(count) as total FROM api_rate_limits WHERE key = :key AND window_ts >= :cutoff',
                { replacements: { key, cutoff: cutoffParam } }
            );
            const total = Number((rows as any[])[0]?.total || 0);
            const allowed = total <= limit;
            const remaining = allowed ? Math.max(0, limit - total) : 0;
            const resetAt = new Date(now + windowMs);
            return { allowed, remaining, resetAt, limit };
        } catch {
            // Fallback path (tiny bucket)
            const entry = this.fallback.get(key);
            if (!entry || entry.expires < now) {
                this.fallback.set(key, { count: cost, expires: now + windowMs });
                return { allowed: true, remaining: Math.max(0, 5 - cost), resetAt: new Date(now + windowMs), limit: 5 };
            }
            entry.count += cost;
            const allowed = entry.count <= 5;
            const remaining = allowed ? 5 - entry.count : 0;
            return { allowed, remaining, resetAt: new Date(entry.expires), limit: 5 };
        }
    }
}
