export interface QuoteCurationQuote {
    id: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
    tags?: string[];
    source?: string | null;
    context?: string | null;
    moderationStatus?: QuoteModerationStatus | null;
}

export type QuoteModerationStatus = "pending" | "approved" | "rejected";
export type QuoteModerationFilter = "all" | QuoteModerationStatus;

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

export interface QuoteTagCount {
    tag: string;
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
    taggedQuotes: number;
    pendingQuotes: number;
    approvedQuotes: number;
    rejectedQuotes: number;
    latestQuote: QuoteCurationQuote | null;
    topAuthors: QuoteAuthorCount[];
    topTags: QuoteTagCount[];
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
            quote.source,
            quote.context,
            quote.moderationStatus,
            ...(quote.tags ?? []),
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
    const tagCounts = new Map<string, number>();
    const submitterIds = new Set<string>();
    let latestQuote: T | null = null;
    let taggedQuotes = 0;
    let pendingQuotes = 0;
    let approvedQuotes = 0;
    let rejectedQuotes = 0;

    for (const quote of quotes) {
        authorCounts.set(quote.authorId, (authorCounts.get(quote.authorId) ?? 0) + 1);
        submitterIds.add(quote.submitterId);
        const moderationStatus = normalizeQuoteModerationStatus(quote.moderationStatus);
        if (moderationStatus === "approved") {
            approvedQuotes += 1;
        } else if (moderationStatus === "rejected") {
            rejectedQuotes += 1;
        } else {
            pendingQuotes += 1;
        }
        if (quote.tags && quote.tags.length > 0) {
            taggedQuotes += 1;
            for (const tag of quote.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
            }
        }
        if (!latestQuote || quote.timestamp > latestQuote.timestamp) {
            latestQuote = quote;
        }
    }

    const topAuthors = Array.from(authorCounts.entries())
        .map(([authorId, count]) => ({ authorId, count }))
        .sort((left, right) => right.count - left.count || left.authorId.localeCompare(right.authorId))
        .slice(0, 5);
    const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
        .slice(0, 8);

    return {
        total: quotes.length,
        uniqueAuthors: authorCounts.size,
        uniqueSubmitters: submitterIds.size,
        taggedQuotes,
        pendingQuotes,
        approvedQuotes,
        rejectedQuotes,
        latestQuote,
        topAuthors,
        topTags,
    };
}

export function filterQuotesByModerationStatus<T extends QuoteCurationQuote>(
    quotes: T[],
    moderationFilter: QuoteModerationFilter,
): T[] {
    if (moderationFilter === "all") return quotes;
    return quotes.filter((quote) => normalizeQuoteModerationStatus(quote.moderationStatus) === moderationFilter);
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

export function parseQuoteTagInput(value: string): string[] {
    const tags: string[] = [];
    const seen = new Set<string>();

    for (const rawTag of value.split(/[,\s]+/)) {
        const tag = normalizeQuoteTag(rawTag);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
        if (tags.length >= 12) break;
    }

    return tags;
}

function normalizeQuoteTag(value: string): string | null {
    const normalized = value
        .trim()
        .replace(/^#+/, "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 32);

    return normalized.length > 0 ? normalized : null;
}

export function normalizeQuoteModerationStatus(value: string | null | undefined): QuoteModerationStatus {
    if (value === "approved" || value === "rejected" || value === "pending") return value;
    return "pending";
}
