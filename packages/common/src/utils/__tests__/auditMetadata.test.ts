import {describe, expect, it} from 'vitest';
import {sanitizeAuditMetadata} from '../auditMetadata.js';

describe('sanitizeAuditMetadata', () => {
    it('redacts sensitive keys recursively', () => {
        const sanitized = sanitizeAuditMetadata({
            channelId: '123',
            nested: {
                authToken: 'secret',
                value: 'safe',
            },
        });

        expect(sanitized).toEqual({
            channelId: '123',
            nested: {
                authToken: '[redacted]',
                value: 'safe',
            },
        });
    });

    it('bounds string, array, and depth-heavy values', () => {
        const sanitized = sanitizeAuditMetadata({
            long: 'x'.repeat(600),
            many: Array.from({length: 25}, (_value, index) => index),
            deep: {
                one: {
                    two: {
                        three: {
                            four: {
                                five: 'hidden',
                            },
                        },
                    },
                },
            },
        });

        expect(typeof sanitized?.long).toBe('string');
        expect((sanitized?.long as string).length).toBe(515);
        expect(sanitized?.many).toEqual(Array.from({length: 20}, (_value, index) => index));
        expect(sanitized?.deep).toEqual({
            one: {
                two: {
                    three: '[truncated]',
                },
            },
        });
    });
});
