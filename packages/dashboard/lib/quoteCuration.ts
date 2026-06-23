export interface QuoteCurationQuote {
    id: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
}

export interface QuoteCurationUser {
    id?: string;
    username?: string;
    global_name?: string | null;
    nickname?: string | null;
    nick?: string | null;
}

export interface QuoteAuthorCount {
    authorId: string;
    count: number;
}

export interface QuoteDuplicateGroup<TQuote extends QuoteCurationQuote = QuoteCurationQuote> {
    normalizedQuote: string;
    count: number;
    latestTimestamp: number;
    quotes: TQuote[];
}

export interface QuoteCurationSummary {
    total: number;
    uniqueAuthors: number;
    uniqueSubmitters: number;
    latestQuote: QuoteCurationQuote | null;
    topAuthors: QuoteAuthorCount[];
}

export function getQuoteUserDisplayName(user?: QuoteCurationUser | null): string {
    if (!user) return "Unknown";
    return user.nickname?.trim()
        || user.nick?.trim()
        || user.global_name?.trim()
        || user.username?.trim()
        || "Unknown";
}

export function filterQuotesForCuration<T extends QuoteCurationQuote>(
    quotes: T[],
    query: string,
    userMap: Record<string, QuoteCurationUser | undefined> = {},
): T[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return quotes;

    return quotes.filter((quote) => {
        const author = userMap[quote.authorId];
        const submitter = userMap[quote.submitterId];
        return [
            quote.id,
            quote.quote,
            quote.authorId,
            quote.submitterId,
            getQuoteUserDisplayName(author),
            getQuoteUserDisplayName(submitter),
            author?.username,
            author?.global_name,
            author?.nickname,
            author?.nick,
            submitter?.username,
            submitter?.global_name,
            submitter?.nickname,
            submitter?.nick,
        ].some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
    });
}

export function buildQuoteCurationSummary<T extends QuoteCurationQuote>(quotes: T[]): QuoteCurationSummary {
    const authorCounts = new Map<string, number>();
    const submitterIds = new Set<string>();
    let latestQuote: T | null = null;

    for (const quote of quotes) {
        authorCounts.set(quote.authorId, (authorCounts.get(quote.authorId) ?? 0) + 1);
        submitterIds.add(quote.submitterId);
        if (!latestQuote || quote.timestamp > latestQuote.timestamp) {
            latestQuote = quote;
        }
    }

    const topAuthors = Array.from(authorCounts.entries())
        .map(([authorId, count]) => ({ authorId, count }))
        .sort((left, right) => right.count - left.count || left.authorId.localeCompare(right.authorId))
        .slice(0, 5);

    return {
        total: quotes.length,
        uniqueAuthors: authorCounts.size,
        uniqueSubmitters: submitterIds.size,
        latestQuote,
        topAuthors,
    };
}

export function getRecentQuotes<T extends QuoteCurationQuote>(quotes: T[], limit = 5): T[] {
    return [...quotes]
        .sort((left, right) => right.timestamp - left.timestamp || right.id.localeCompare(left.id))
        .slice(0, Math.max(0, limit));
}

export function normalizeQuoteForDuplicateReview(value: string): string {
    return value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

export function findDuplicateQuoteGroups<T extends QuoteCurationQuote>(quotes: T[], limit = 5): QuoteDuplicateGroup<T>[] {
    const groups = new Map<string, T[]>();

    for (const quote of quotes) {
        const normalizedQuote = normalizeQuoteForDuplicateReview(quote.quote);
        if (!normalizedQuote) continue;
        groups.set(normalizedQuote, [...(groups.get(normalizedQuote) ?? []), quote]);
    }

    return Array.from(groups.entries())
        .filter(([, groupQuotes]) => groupQuotes.length > 1)
        .map(([normalizedQuote, groupQuotes]) => {
            const sortedQuotes = [...groupQuotes].sort((left, right) => right.timestamp - left.timestamp || right.id.localeCompare(left.id));
            return {
                normalizedQuote,
                count: sortedQuotes.length,
                latestTimestamp: sortedQuotes[0]?.timestamp ?? 0,
                quotes: sortedQuotes,
            };
        })
        .sort((left, right) => right.count - left.count || right.latestTimestamp - left.latestTimestamp || left.normalizedQuote.localeCompare(right.normalizedQuote))
        .slice(0, Math.max(0, limit));
}
