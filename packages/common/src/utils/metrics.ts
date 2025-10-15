// Lightweight in-process metrics counters with optional periodic summary logging.
// Strict TypeScript, ESM, and named exports only.

import { getLogger } from './logger.js';

export type MetricLabels = Record<string, string>;

interface CounterEntry {
    count: number;
    labels: MetricLabels;
}

function labelsKey(labels: MetricLabels | undefined): string {
    if (!labels) return '';
    const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([k, v]) => `${k}=${v}`).join(',');
}

class MetricsRegistry {
    private counters: Map<string, CounterEntry> = new Map();

    inc(name: string, labels?: MetricLabels, value = 1): void {
        if (!Number.isFinite(value) || value === 0) return;
        const key = `${name}|${labelsKey(labels)}`;
        const existing = this.counters.get(key);
        if (existing) {
            existing.count += value;
            return;
        }
        this.counters.set(key, { count: value, labels: labels ?? {} });
    }

    snapshot(): Array<{ name: string; labels: MetricLabels; count: number }> {
        const out: Array<{ name: string; labels: MetricLabels; count: number }> = [];
        for (const [key, entry] of this.counters.entries()) {
            const [name] = key.split('|', 1);
            out.push({ name, labels: entry.labels, count: entry.count });
        }
        return out;
    }

    reset(): void {
        this.counters.clear();
    }
}

const registry = new MetricsRegistry();

/** Increment a named counter with optional labels. */
export function incMetric(name: string, labels?: MetricLabels, value = 1): void {
    registry.inc(name, labels, value);
}

/** Get a snapshot of all counters. */
export function getMetricsSnapshot(): Array<{ name: string; labels: MetricLabels; count: number }> {
    return registry.snapshot();
}

/** Reset all counters (typically only used in tests). */
export function resetMetrics(): void {
    registry.reset();
}

/**
 * Start a periodic summary logger that prints aggregated counts.
 * Returns a function to stop the logger.
 */
export function startMetricsSummaryLogger(opts?: { intervalMs?: number; service?: string; loggerName?: string }): () => void {
    const intervalMs = Math.max(1000, Number(opts?.intervalMs ?? Number(process.env.METRICS_SUMMARY_INTERVAL_MS ?? 60_000)));
    const service = opts?.service ?? process.env.SERVICE_NAME ?? 'app';
    const loggerName = opts?.loggerName ?? 'metrics';
    const log = getLogger({ name: loggerName });

    // Skip in tests by default to keep output clean
    if (process.env.NODE_ENV === 'test') {
        return () => { /* noop */ };
    }

    const timer = setInterval(() => {
        const snapshot = registry.snapshot();
        if (snapshot.length === 0) return;
        // Aggregate by name only for a concise summary, but include sample labels count
        const aggregate = new Map<string, number>();
        for (const s of snapshot) {
            aggregate.set(s.name, (aggregate.get(s.name) ?? 0) + s.count);
        }
        const summary: Record<string, number> = {};
        for (const [k, v] of aggregate.entries()) summary[k] = v;
        log.info({ service, summary, distinctSeries: snapshot.length }, '[metrics] summary');
    }, intervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
}

