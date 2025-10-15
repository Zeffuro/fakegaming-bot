// Basic tests for in-process metrics utility
import { describe, it, expect, beforeEach } from 'vitest';

import { incMetric, getMetricsSnapshot, resetMetrics, startMetricsSummaryLogger } from '../utils/metrics.js';

describe('metrics utility', () => {
    beforeEach(() => {
        resetMetrics();
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

    it('summary logger does not throw and can be stopped', async () => {
        // Force a very short interval; in test env startMetricsSummaryLogger returns noop
        const stop = startMetricsSummaryLogger({ intervalMs: 10 });
        expect(typeof stop).toBe('function');
        stop();
    });
});

