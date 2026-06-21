import type {AuditEventMetadata} from '../models/audit-event.js';

const SENSITIVE_KEY_RE = /(?:authorization|cookie|csrf|jwt|password|secret|token|key|credential|session)/i;
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

/**
 * Sanitizes audit metadata before persistence by redacting sensitive keys and bounding payload size.
 */
export function sanitizeAuditMetadata(metadata: Record<string, unknown> | null | undefined): AuditEventMetadata | null {
    if (!metadata) return null;
    const sanitized = sanitizeValue(metadata, 0);
    return typeof sanitized === 'object' && sanitized !== null && !Array.isArray(sanitized)
        ? sanitized as AuditEventMetadata
        : { value: sanitized };
}

function sanitizeValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value.toISOString();

    const valueType = typeof value;
    if (valueType === 'string') {
        const text = value as string;
        return text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH)}...` : text;
    }

    if (valueType === 'number' || valueType === 'boolean') return value;

    if (Array.isArray(value)) {
        if (depth >= MAX_DEPTH) return '[truncated]';
        return value.slice(0, MAX_ARRAY_LENGTH).map(item => sanitizeValue(item, depth + 1));
    }

    if (valueType === 'object') {
        if (depth >= MAX_DEPTH) return '[truncated]';
        const output: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_KEY_RE.test(key)) {
                output[key] = '[redacted]';
                continue;
            }
            output[key] = sanitizeValue(nestedValue, depth + 1);
        }
        return output;
    }

    return String(value);
}
