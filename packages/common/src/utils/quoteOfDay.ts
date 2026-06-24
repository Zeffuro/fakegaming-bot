export interface QuoteOfDayCandidate {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number | string;
    moderationStatus?: string | null;
}

export interface QuoteOfDaySelection<T extends QuoteOfDayCandidate> {
    dateKey: string;
    quote: T | null;
    eligibleCount: number;
    index: number | null;
}

export const quoteOfDayProvider = 'quoteofday';

export function selectQuoteOfDay<T extends QuoteOfDayCandidate>(
    candidates: readonly T[],
    guildId: string,
    date: Date = new Date()
): QuoteOfDaySelection<T> {
    const dateKey = formatQuoteOfDayDateKey(date);
    const eligible = candidates
        .filter((candidate) => candidate.guildId === guildId && candidate.moderationStatus === 'approved')
        .sort((left, right) => left.id.localeCompare(right.id));

    if (eligible.length === 0) {
        return {
            dateKey,
            quote: null,
            eligibleCount: 0,
            index: null,
        };
    }

    const index = hashQuoteOfDayKey(`${guildId}:${dateKey}`) % eligible.length;
    return {
        dateKey,
        quote: eligible[index] ?? null,
        eligibleCount: eligible.length,
        index,
    };
}

export function buildQuoteOfDayEventId(guildId: string, date: Date = new Date()): string {
    return `${guildId}:${formatQuoteOfDayDateKey(date)}`;
}

export function formatQuoteOfDayDateKey(date: Date): string {
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    return safeDate.toISOString().slice(0, 10);
}

function hashQuoteOfDayKey(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}
