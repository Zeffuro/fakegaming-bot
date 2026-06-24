const summaryKeyLimit = 4;
const sensitiveKeyPattern = /(?:authorization|cookie|csrf|jwt|password|secret|token|key|credential|session)/i;
const maxStringLength = 512;
const maxArrayLength = 20;
const maxDepth = 4;

export interface AdminAuditMetadataView {
    hasMetadata: boolean;
    keyCount: number;
    keys: string[];
    summary: string;
    formatted: string;
}

export function buildAdminAuditMetadataView(metadata: Record<string, unknown> | null): AdminAuditMetadataView {
    const sanitized = sanitizeAuditMetadataForDisplay(metadata);
    if (!sanitized || Object.keys(sanitized).length === 0) {
        return {
            hasMetadata: false,
            keyCount: 0,
            keys: [],
            summary: "No metadata",
            formatted: "No metadata recorded for this event.",
        };
    }

    const keys = Object.keys(sanitized).sort((left, right) => left.localeCompare(right));
    return {
        hasMetadata: true,
        keyCount: keys.length,
        keys,
        summary: formatMetadataSummary(keys),
        formatted: JSON.stringify(sanitized, null, 2),
    };
}

function formatMetadataSummary(keys: readonly string[]): string {
    const visibleKeys = keys.slice(0, summaryKeyLimit);
    const hiddenCount = Math.max(0, keys.length - visibleKeys.length);
    const suffix = hiddenCount > 0 ? `, +${hiddenCount} more` : "";
    return `${keys.length} metadata ${keys.length === 1 ? "key" : "keys"}: ${visibleKeys.join(", ")}${suffix}`;
}

function sanitizeAuditMetadataForDisplay(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    if (!metadata) return null;
    const sanitized = sanitizeValue(metadata, 0);
    return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
        ? sanitized as Record<string, unknown>
        : { value: sanitized };
}

function sanitizeValue(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value.toISOString();

    if (typeof value === "string") {
        return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}...` : value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (Array.isArray(value)) {
        if (depth >= maxDepth) return "[truncated]";
        return value.slice(0, maxArrayLength).map(item => sanitizeValue(item, depth + 1));
    }

    if (typeof value === "object") {
        if (depth >= maxDepth) return "[truncated]";
        const output: Record<string, unknown> = {};
        for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
            output[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeValue(nestedValue, depth + 1);
        }
        return output;
    }

    return String(value);
}
