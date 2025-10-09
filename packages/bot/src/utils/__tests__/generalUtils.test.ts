import { describe, it, expect } from 'vitest';
import { timeAgo, formatDuration, cleanDiscordContent, minutes, truncateDescription } from '../generalUtils.js';

describe('generalUtils', () => {
    describe('timeAgo', () => {
        it('should return "just now" for very recent times', () => {
            const now = Date.now();
            expect(timeAgo(now - 1000, now)).toBe('just now');
            expect(timeAgo(now, now)).toBe('just now');
        });

        it('should return minutes ago', () => {
            const now = Date.now();
            expect(timeAgo(now - 60000, now)).toBe('1 min ago');
            expect(timeAgo(now - 120000, now)).toBe('2 min ago');
            expect(timeAgo(now - 1800000, now)).toBe('30 min ago');
        });

        it('should return hours ago', () => {
            const now = Date.now();
            expect(timeAgo(now - 3600000, now)).toBe('1 hour ago');
            expect(timeAgo(now - 7200000, now)).toBe('2 hours ago');
        });

        it('should return days ago', () => {
            const now = Date.now();
            expect(timeAgo(now - 86400000, now)).toBe('1 day ago');
            expect(timeAgo(now - 172800000, now)).toBe('2 days ago');
        });

        it('should use current time when nowTimestampMs is not provided', () => {
            const past = Date.now() - 60000;
            const result = timeAgo(past);
            expect(result).toBe('1 min ago');
        });
    });

    describe('formatDuration', () => {
        it('should format duration correctly', () => {
            expect(formatDuration(0)).toBe('0m 00s');
            expect(formatDuration(30)).toBe('0m 30s');
            expect(formatDuration(60)).toBe('1m 00s');
            expect(formatDuration(90)).toBe('1m 30s');
            expect(formatDuration(125)).toBe('2m 05s');
            expect(formatDuration(3661)).toBe('61m 01s');
        });

        it('should pad seconds with zero', () => {
            expect(formatDuration(65)).toBe('1m 05s');
            expect(formatDuration(601)).toBe('10m 01s');
        });
    });

    describe('cleanDiscordContent', () => {
        it('should remove tabs', () => {
            expect(cleanDiscordContent('hello\tworld')).toBe('helloworld');
            expect(cleanDiscordContent('test\t\t\ttext')).toBe('testtext');
        });

        it('should collapse multiple newlines', () => {
            expect(cleanDiscordContent('line1\n\n\nline2')).toBe('line1\nline2');
            expect(cleanDiscordContent('a\n\nb\n\n\nc')).toBe('a\nb\nc');
        });

        it('should trim whitespace', () => {
            expect(cleanDiscordContent('  text  ')).toBe('text');
            expect(cleanDiscordContent('\n\ntext\n\n')).toBe('text');
        });

        it('should handle combination of formatting issues', () => {
            // Function collapses newlines but keeps single newlines
            expect(cleanDiscordContent('\t\thello\n\n\nworld\t\t')).toBe('hello\nworld');
        });

        it('should preserve single newlines', () => {
            expect(cleanDiscordContent('line1\nline2')).toBe('line1\nline2');
        });
    });

    describe('minutes', () => {
        it('should convert minutes to milliseconds', () => {
            expect(minutes(1)).toBe(60000);
            expect(minutes(5)).toBe(300000);
            expect(minutes(60)).toBe(3600000);
        });

        it('should handle zero and decimals', () => {
            expect(minutes(0)).toBe(0);
            expect(minutes(0.5)).toBe(30000);
        });
    });

    describe('truncateDescription', () => {
        it('should not truncate text shorter than max', () => {
            expect(truncateDescription('short text', 100)).toBe('short text');
        });

        it('should truncate text longer than max', () => {
            const longText = 'This is a very long text that should be truncated';
            const result = truncateDescription(longText, 20);
            expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
            expect(result).toContain('...');
        });

        it('should truncate at word boundary when possible', () => {
            const text = 'Hello world this is a test';
            const result = truncateDescription(text, 15);
            expect(result).toBe('Hello world...');
        });

        it('should handle text without spaces', () => {
            const text = 'A'.repeat(100);
            const result = truncateDescription(text, 50);
            expect(result.length).toBe(50);
            expect(result.endsWith('...')).toBe(true);
        });

        it('should preserve full text when exactly at max length', () => {
            const text = 'A'.repeat(50);
            expect(truncateDescription(text, 50)).toBe(text);
        });

        it('should handle edge case with last space near boundary', () => {
            const text = 'Short text with some words here';
            const result = truncateDescription(text, 20);
            expect(result.endsWith('...')).toBe(true);
            expect(result.length).toBeLessThanOrEqual(23);
        });
    });
});
