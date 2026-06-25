import { createCanvas, type CanvasRenderingContext2D } from 'canvas';

export const QUOTE_CARD_MIME_TYPE = 'image/png';

export interface QuoteCardInput {
    quote: string;
    authorName: string;
    authorId?: string | null;
    submitterName?: string | null;
    timestamp?: number | string | null;
    tags?: readonly string[] | null;
    source?: string | null;
    context?: string | null;
    guildName?: string | null;
}

export interface QuoteCardRenderOptions {
    width?: number;
    height?: number;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const CARD_PADDING = 64;
const FONT_FAMILY = '"Segoe UI", "Noto Sans", Arial, sans-serif';
const TITLE_FONT = `800 50px ${FONT_FAMILY}`;
const BODY_FONT = `700 44px ${FONT_FAMILY}`;
const BODY_SMALL_FONT = `700 38px ${FONT_FAMILY}`;
const META_FONT = `700 24px ${FONT_FAMILY}`;
const MUTED_FONT = `600 22px ${FONT_FAMILY}`;
const TAG_FONT = `700 20px ${FONT_FAMILY}`;

interface WrappedLine {
    text: string;
    width: number;
}

export function renderQuoteCard(input: QuoteCardInput, options: QuoteCardRenderOptions = {}): Buffer {
    const width = normalizeDimension(options.width, DEFAULT_WIDTH);
    const height = normalizeDimension(options.height, DEFAULT_HEIGHT);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    drawBackground(ctx, width, height);
    drawQuoteCardContent(ctx, input, width, height);

    return canvas.toBuffer(QUOTE_CARD_MIME_TYPE);
}

export function buildQuoteCardFilename(quoteId: string): string {
    const safeId = quoteId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return `quote-card-${safeId || 'quote'}.png`;
}

function normalizeDimension(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(320, Math.min(2400, Math.floor(value)));
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#121826');
    gradient.addColorStop(0.48, '#221a31');
    gradient.addColorStop(1, '#0f2a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#46d9c8';
    ctx.rotate(-0.17);
    ctx.fillRect(-80, height - 90, width + 160, 52);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ff6f91';
    ctx.fillRect(width * 0.46, -150, 390, height + 300);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    roundedRect(ctx, 36, 36, width - 72, height - 72, 30);
    ctx.stroke();
    ctx.restore();
}

function drawQuoteCardContent(ctx: CanvasRenderingContext2D, input: QuoteCardInput, width: number, height: number): void {
    const quote = normalizeWhitespace(input.quote);
    const title = input.guildName?.trim() || 'FakeGaming Quotes';
    const source = normalizeOptional(input.source);
    const context = normalizeOptional(input.context);
    const tags = normalizeTags(input.tags);

    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 18, 0.55)';
    roundedRect(ctx, CARD_PADDING, CARD_PADDING, width - CARD_PADDING * 2, height - CARD_PADDING * 2, 26);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.font = MUTED_FONT;
    ctx.textBaseline = 'top';
    ctx.fillText(title, CARD_PADDING + 34, CARD_PADDING + 30);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.font = `900 120px ${FONT_FAMILY}`;
    ctx.fillText('"', CARD_PADDING + 26, CARD_PADDING + 74);

    const contentX = CARD_PADDING + 86;
    const contentY = CARD_PADDING + 116;
    const contentWidth = width - contentX - CARD_PADDING - 44;
    ctx.font = quote.length > 180 ? BODY_SMALL_FONT : BODY_FONT;
    ctx.fillStyle = '#ffffff';
    const maxQuoteLines = quote.length > 250 ? 6 : 5;
    const quoteLines = wrapText(ctx, quote, contentWidth, maxQuoteLines);
    drawLines(ctx, quoteLines, contentX, contentY, quote.length > 180 ? 48 : 56);

    const metaY = Math.min(height - CARD_PADDING - 120, contentY + quoteLines.length * (quote.length > 180 ? 48 : 56) + 24);
    drawAuthorLine(ctx, input, contentX, metaY, contentWidth);

    const detailY = metaY + 42;
    drawDetails(ctx, { source, context, submitterName: input.submitterName, timestamp: input.timestamp }, contentX, detailY, contentWidth);

    if (tags.length > 0) {
        drawTags(ctx, tags, contentX, height - CARD_PADDING - 56, contentWidth);
    }
}

function drawAuthorLine(ctx: CanvasRenderingContext2D, input: QuoteCardInput, x: number, y: number, maxWidth: number): void {
    const author = input.authorName.trim() || formatFallbackUser(input.authorId);
    ctx.font = TITLE_FONT;
    ctx.fillStyle = '#46d9c8';
    const prefix = '- ';
    ctx.fillText(prefix, x, y);
    const prefixWidth = ctx.measureText(prefix).width;
    const fittedAuthor = fitText(ctx, author, maxWidth - prefixWidth);
    ctx.fillStyle = '#f9fbff';
    ctx.fillText(fittedAuthor, x + prefixWidth, y);
}

function drawDetails(
    ctx: CanvasRenderingContext2D,
    input: { source: string | null; context: string | null; submitterName: string | null | undefined; timestamp: number | string | null | undefined },
    x: number,
    y: number,
    maxWidth: number,
): void {
    const submitter = normalizeOptional(input.submitterName);
    const parts = [
        formatQuoteCardDate(input.timestamp),
        submitter ? `submitted by ${submitter}` : null,
        input.source,
        input.context,
    ]
        .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length === 0) return;

    ctx.font = META_FONT;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
    ctx.fillText(fitText(ctx, parts.join('  |  '), maxWidth), x, y);
}

function drawTags(ctx: CanvasRenderingContext2D, tags: readonly string[], x: number, y: number, maxWidth: number): void {
    ctx.font = TAG_FONT;
    let currentX = x;
    for (const tag of tags.slice(0, 6)) {
        const label = `#${tag}`;
        const textWidth = ctx.measureText(label).width;
        const chipWidth = Math.ceil(textWidth + 28);
        if (currentX !== x && currentX + chipWidth > x + maxWidth) break;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        roundedRect(ctx, currentX, y, chipWidth, 34, 17);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
        ctx.fillText(label, currentX + 14, y + 6);
        currentX += chipWidth + 10;
    }
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): WrappedLine[] {
    const words = value.split(' ').flatMap(splitLongWord);
    const lines: WrappedLine[] = [];
    let line = '';

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        const width = ctx.measureText(candidate).width;
        if (width <= maxWidth || !line) {
            line = candidate;
            continue;
        }

        lines.push({ text: line, width: ctx.measureText(line).width });
        line = word;
        if (lines.length === maxLines) break;
    }

    if (line && lines.length < maxLines) {
        lines.push({ text: line, width: ctx.measureText(line).width });
    }

    if (lines.length === maxLines && words.join(' ').length > lines.map(item => item.text).join(' ').length) {
        const last = lines[lines.length - 1];
        if (last) {
            last.text = fitText(ctx, `${last.text}...`, maxWidth);
            last.width = ctx.measureText(last.text).width;
        }
    }

    return lines.length > 0 ? lines : [{ text: ' ', width: 0 }];
}

function splitLongWord(word: string): string[] {
    if (word.length <= 28) return [word];
    const parts: string[] = [];
    for (let index = 0; index < word.length; index += 24) {
        parts.push(word.slice(index, index + 24));
    }
    return parts;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: readonly WrappedLine[], x: number, y: number, lineHeight: number): void {
    lines.forEach((line, index) => {
        ctx.fillText(line.text, x, y + index * lineHeight);
    });
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
    if (ctx.measureText(value).width <= maxWidth) return value;
    const ellipsis = '...';
    let low = 0;
    let high = value.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        const candidate = `${value.slice(0, mid).trimEnd()}${ellipsis}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return `${value.slice(0, low).trimEnd()}${ellipsis}`;
}

function normalizeWhitespace(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized || ' ';
}

function normalizeOptional(value: string | null | undefined): string | null {
    const normalized = value?.replace(/\s+/g, ' ').trim();
    return normalized ? normalized : null;
}

function normalizeTags(tags: readonly string[] | null | undefined): string[] {
    if (!tags) return [];
    return tags
        .map(tag => tag.trim().replace(/^#+/, ''))
        .filter(tag => tag.length > 0)
        .slice(0, 8);
}

function formatFallbackUser(userId: string | null | undefined): string {
    const normalized = userId?.trim();
    if (!normalized) return 'Unknown author';
    return `Discord user ${normalized.slice(-6)}`;
}

function formatQuoteCardDate(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const timestamp = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(new Date(timestamp));
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
}
