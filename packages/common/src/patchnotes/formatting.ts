import * as cheerio from 'cheerio';
import { cleanDiscordContent } from '../utils/text.js';

export const PATCH_NOTE_EMBED_DESCRIPTION_LIMIT = 1800;

type LoadedCheerio = ReturnType<typeof cheerio.load>;
type CheerioElement = Parameters<LoadedCheerio>[0];

function truncateAtBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const hardLimit = Math.max(0, maxLength - 3);
    const cut = text.slice(0, hardLimit);
    const paragraphBreak = cut.lastIndexOf('\n\n');
    const sentenceBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    const lastSpace = cut.lastIndexOf(' ');
    const truncateAt = paragraphBreak > maxLength * 0.55
        ? paragraphBreak
        : sentenceBreak > maxLength * 0.55
            ? sentenceBreak + 1
            : lastSpace > maxLength * 0.55
                ? lastSpace
                : hardLimit;

    return `${cut.slice(0, truncateAt).trim()}...`;
}

function textFromElement($: LoadedCheerio, element: CheerioElement): string {
    return cleanDiscordContent($(element).text().replace(/\u00a0/g, ' '));
}

function formatListItem($: LoadedCheerio, element: CheerioElement, depth: number): string[] {
    const item = $(element).clone();
    item.children('ul, ol').remove();

    const text = cleanDiscordContent(item.text().replace(/\u00a0/g, ' '));
    const lines = text ? [`${'  '.repeat(depth)}- ${text}`] : [];

    $(element).children('ul, ol').children('li').each((_index: number, child: CheerioElement) => {
        lines.push(...formatListItem($, child, depth + 1));
    });

    return lines;
}

export function htmlToDiscordText(html: string): string {
    const $ = cheerio.load(`<root>${html}</root>`);
    const lines: string[] = [];

    $('root').children().each((_index: number, element: CheerioElement) => {
        const tagName = typeof (element as { tagName?: unknown }).tagName === 'string'
            ? (element as { tagName: string }).tagName.toLowerCase()
            : undefined;
        if (!tagName) return;

        if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4') {
            const text = textFromElement($, element);
            if (text) lines.push(`**${text}**`);
            return;
        }

        if (tagName === 'p' || tagName === 'blockquote') {
            const text = textFromElement($, element);
            if (text) lines.push(text);
            return;
        }

        if (tagName === 'ul' || tagName === 'ol') {
            $(element).children('li').each((_childIndex: number, child: CheerioElement) => {
                lines.push(...formatListItem($, child, 0));
            });
            return;
        }

        if (tagName === 'hr') {
            lines.push('---');
            return;
        }

        const text = textFromElement($, element);
        if (text) lines.push(text);
    });

    return cleanDiscordContent(lines.join('\n\n'));
}

export function formatPatchNoteEmbedDescription(content: string, maxLength = PATCH_NOTE_EMBED_DESCRIPTION_LIMIT): string {
    return truncateAtBoundary(cleanDiscordContent(content), maxLength);
}
