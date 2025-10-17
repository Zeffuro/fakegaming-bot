import { describe, it, expect } from 'vitest';
import { computeBirthdayRetryBackoffSeconds } from '../birthdays.js';

describe('computeBirthdayRetryBackoffSeconds', () => {
    it('returns base for first attempt', () => {
        expect(computeBirthdayRetryBackoffSeconds(1)).toBe(60);
    });
    it('doubles for subsequent attempts', () => {
        expect(computeBirthdayRetryBackoffSeconds(2)).toBe(120);
        expect(computeBirthdayRetryBackoffSeconds(3)).toBe(240);
    });
    it('caps at max', () => {
        expect(computeBirthdayRetryBackoffSeconds(5)).toBe(900); // 60 * 2^(5-1) = 960 -> capped to 900
    });
    it('clamps invalid attempts to 1', () => {
        expect(computeBirthdayRetryBackoffSeconds(0)).toBe(60);
        expect(computeBirthdayRetryBackoffSeconds(-3)).toBe(60);
    });
});

