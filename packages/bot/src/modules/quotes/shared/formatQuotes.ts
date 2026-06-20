export interface QuoteLike {
    quote: string;
    authorId: string;
    timestamp?: number | string | null | undefined;
}

export function formatQuoteDisplay(q: QuoteLike): string {
    const tsRaw = q.timestamp;
    const ts = typeof tsRaw === 'string' ? Number(tsRaw) : (tsRaw ?? 0);
    const dateStr = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : 'Unknown date';
    return `> ${q.quote}\n- <@${q.authorId}> (${dateStr})`;
}

export function formatQuotesBlock(quotes: readonly QuoteLike[]): string {
    return quotes.map(formatQuoteDisplay).join('\n\n');
}

export function formatQuotesForUser(userLabel: string, quotes: readonly QuoteLike[]): string {
    if (quotes.length === 0) {
        return `No quotes found for ${userLabel}.`;
    }

    return `Quotes for ${userLabel}:\n${formatQuotesBlock(quotes)}`;
}

export function formatQuotePreview(text: string, maxLength = 180): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
