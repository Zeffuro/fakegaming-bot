import { describe, expect, it } from 'vitest';
import {
    computeNextDigestRunAt,
    getDigestWindowMs,
    normalizeDigestCategories,
    parseDigestCategories,
    serializeDigestCategories,
} from '../digestSchedule.js';

describe('digestSchedule', () => {
    it('computes the next daily local run', () => {
        const next = computeNextDigestRunAt({
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:30',
            afterTimestamp: Date.parse('2026-06-23T08:00:00.000Z'),
        });

        expect(next).toBe(Date.parse('2026-06-23T09:30:00.000Z'));
    });

    it('moves daily runs to the next day after the configured time', () => {
        const next = computeNextDigestRunAt({
            frequency: 'daily',
            timezone: 'UTC',
            runAt: '09:30',
            afterTimestamp: Date.parse('2026-06-23T10:00:00.000Z'),
        });

        expect(next).toBe(Date.parse('2026-06-24T09:30:00.000Z'));
    });

    it('supports weekly runs on the configured local weekday', () => {
        const next = computeNextDigestRunAt({
            frequency: 'weekly',
            timezone: 'UTC',
            runAt: '08:00',
            dayOfWeek: 1,
            afterTimestamp: Date.parse('2026-06-23T10:00:00.000Z'),
        });

        expect(next).toBe(Date.parse('2026-06-29T08:00:00.000Z'));
    });

    it('rejects invalid schedules', () => {
        expect(computeNextDigestRunAt({
            frequency: 'daily',
            timezone: 'Not/AZone',
            runAt: '09:00',
            afterTimestamp: Date.parse('2026-06-23T10:00:00.000Z'),
        })).toBeNull();
        expect(computeNextDigestRunAt({
            frequency: 'weekly',
            timezone: 'UTC',
            runAt: '25:00',
            afterTimestamp: Date.parse('2026-06-23T10:00:00.000Z'),
        })).toBeNull();
    });

    it('normalizes category storage to supported values', () => {
        expect(normalizeDigestCategories(['reminders', 'anime', 'unknown', 'reminders'])).toEqual(['reminders', 'anime']);
        expect(parseDigestCategories(serializeDigestCategories(['anime']))).toEqual(['anime']);
        expect(parseDigestCategories('not-json')).toEqual(['reminders']);
    });

    it('returns the digest lookahead window by frequency', () => {
        expect(getDigestWindowMs('daily')).toBe(24 * 60 * 60 * 1000);
        expect(getDigestWindowMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000);
    });
});
