export interface QuoteLike {
    quote: string;
    authorId: string;
    timestamp?: number | string | null | undefined;
}

/**
 * Format a single quote into a display string with author mention and date.
 */
export function formatQuoteDisplay(q: QuoteLike): string {
    const tsRaw = q.timestamp;
    const ts = typeof tsRaw === 'string' ? Number(tsRaw) : (tsRaw ?? 0);
    const dateStr = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : 'Unknown date';
    return `> ${q.quote}\n— <@${q.authorId}> (${dateStr})`;
}

/**
 * Join a list of quotes into a block suitable for replying in Discord.
 */
export function formatQuotesBlock(quotes: readonly QuoteLike[]): string {
    return quotes.map(formatQuoteDisplay).join("\n\n");
}

