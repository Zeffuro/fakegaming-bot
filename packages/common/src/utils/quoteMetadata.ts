const maxQuoteTags = 12;
const maxQuoteTagLength = 32;

export function normalizeQuoteTag(value: string): string | null {
    const normalized = value
        .trim()
        .replace(/^#+/, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, maxQuoteTagLength);

    return normalized.length > 0 ? normalized : null;
}

export function normalizeQuoteTags(value: unknown): string[] {
    const rawTags = Array.isArray(value)
        ? value
        : typeof value === 'string' ? parseTagString(value) : [];
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const rawTag of rawTags) {
        if (typeof rawTag !== 'string') continue;
        const tag = normalizeQuoteTag(rawTag);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
        if (tags.length >= maxQuoteTags) break;
    }

    return tags;
}

export function serializeQuoteTags(value: unknown): string | null {
    const tags = normalizeQuoteTags(value);
    return tags.length > 0 ? JSON.stringify(tags) : null;
}

export function parseStoredQuoteTags(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return normalizeQuoteTags(value);
    if (typeof value !== 'string') return [];

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed: unknown = JSON.parse(trimmed);
        return normalizeQuoteTags(parsed);
    } catch {
        return normalizeQuoteTags(trimmed);
    }
}

function parseTagString(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split(/[,\s]+/).filter(Boolean);
}
