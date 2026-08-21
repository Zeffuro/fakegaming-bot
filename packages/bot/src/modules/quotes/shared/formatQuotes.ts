import { runtimeText } from '../../../core/runtimeCopy.js';
import { DEFAULT_OUTPUT_LOCALE, getOutputLocaleMetadata } from '@zeffuro/fakegaming-common';
export interface QuoteLike {
    quote: string;
    authorId: string;
    timestamp?: number | string | null | undefined;
}

export function formatQuoteDisplay(q: QuoteLike, locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    const tsRaw = q.timestamp;
    const ts = typeof tsRaw === 'string' ? Number(tsRaw) : (tsRaw ?? 0);
    const dateStr = Number.isFinite(ts) && ts > 0
        ? new Date(ts).toLocaleString(getOutputLocaleMetadata(locale).formatTag)
        : quoteText(locale, "unknownDate");
    return `> ${q.quote}\n- <@${q.authorId}> (${dateStr})`;
}

export function formatQuotesBlock(quotes: readonly QuoteLike[], locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    return quotes.map(quote => formatQuoteDisplay(quote, locale)).join('\n\n');
}

export function formatQuotesForUser(userLabel: string, quotes: readonly QuoteLike[], locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE): string {
    if (quotes.length === 0) {
        return runtimeText(locale, 'quotes', 'noQuotesFoundFor', {user: userLabel});
    }

    return `${quoteText(locale, "quotesFor")} ${userLabel}:\n${formatQuotesBlock(quotes, locale)}`;
}

export function formatQuotePreview(text: string, maxLength = 180): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
import type { SupportedOutputLocale } from '../../../core/localization.js';
import { quoteText } from '../copy/quoteCopy.js';
