// Basic tests for in-process metrics utility
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { incMetric, getMetricsSnapshot, resetMetrics, startMetricsSummaryLogger } from '../utils/metrics.js';

describe('metrics utility', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMetricsInterval = process.env.METRICS_SUMMARY_INTERVAL_MS;
    const originalServiceName = process.env.SERVICE_NAME;

    beforeEach(() => {
        resetMetrics();
    });

    afterEach(() => {
        resetMetrics();
        vi.useRealTimers();
        process.env.NODE_ENV = originalNodeEnv;
        if (originalMetricsInterval === undefined) {
            delete process.env.METRICS_SUMMARY_INTERVAL_MS;
        } else {
            process.env.METRICS_SUMMARY_INTERVAL_MS = originalMetricsInterval;
        }
        if (originalServiceName === undefined) {
            delete process.env.SERVICE_NAME;
        } else {
            process.env.SERVICE_NAME = originalServiceName;
        }
    });

    it('increments counters and snapshots totals by series', () => {
        incMetric('job_ok', { job: 'a' });
        incMetric('job_ok', { job: 'a' });
        incMetric('job_ok', { job: 'b' });
        const snap = getMetricsSnapshot();
        const sortKey = (x: { name: string; labels: Record<string, string>; count: number }) => `${x.name}:${x.labels.job ?? ''}`;
        const bySeries = snap.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
        expect(bySeries).toEqual([
            { name: 'job_ok', labels: { job: 'a' }, count: 2 },
            { name: 'job_ok', labels: { job: 'b' }, count: 1 }
        ]);
    });

    it('reset clears all counters', () => {
        incMetric('api_error', { type: 'unhandled' });
        expect(getMetricsSnapshot().length).toBe(1);
        resetMetrics();
        expect(getMetricsSnapshot().length).toBe(0);
    });

    it('normalizes labels and ignores zero or non-finite increments', () => {
        incMetric('ignored_zero', undefined, 0);
        incMetric('ignored_infinite', undefined, Number.POSITIVE_INFINITY);
        incMetric('requests', { b: 'two', a: 'one' });
        incMetric('requests', { a: 'one', b: 'two' }, 2);
        incMetric('unlabelled');

        const snap = getMetricsSnapshot().sort((a, b) => a.name.localeCompare(b.name));
        expect(snap).toEqual([
            { name: 'requests', labels: { b: 'two', a: 'one' }, count: 3 },
            { name: 'unlabelled', labels: {}, count: 1 },
        ]);
    });

    it('summary logger does not throw and can be stopped', async () => {
        // Force a very short interval; in test env startMetricsSummaryLogger returns noop
        const stop = startMetricsSummaryLogger({ intervalMs: 10 });
        expect(typeof stop).toBe('function');
        stop();
    });

    it('logs periodic summaries outside test mode and can stop the interval', () => {
        vi.useFakeTimers();
        process.env.NODE_ENV = 'development';
        process.env.SERVICE_NAME = 'metrics-test-service';

        incMetric('job_ok', { job: 'a' }, 2);
        incMetric('job_ok', { job: 'b' }, 3);
        incMetric('job_error', { job: 'a' });

        const stop = startMetricsSummaryLogger({ intervalMs: 1, loggerName: 'metrics:test' });
        vi.advanceTimersByTime(1000);
        stop();

        expect(vi.getTimerCount()).toBe(0);
    });
});

