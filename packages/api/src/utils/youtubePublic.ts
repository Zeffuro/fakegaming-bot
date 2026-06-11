export interface PublicYouTubeChannelMetadata {
    title: string | null;
    url: string | null;
    latestVideoId: string | null;
}

export interface PublicYouTubeVideo {
    videoId: string;
    title: string | null;
    author: string | null;
    link: string;
}

export function getHttpStatusFromError(err: unknown): number | null {
    const candidate = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown }; message?: unknown };
    const direct = candidate.statusCode ?? candidate.status ?? candidate.response?.status;
    if (typeof direct === 'number') return direct;
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const match = message.match(/Status code\s+(\d{3})/i);
    return match ? Number(match[1]) : null;
}

export function decodeHtmlText(value: string): string {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_m, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}

export function extractMetaContent(html: string, key: string): string | null {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`<meta\\s+[^>]*(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${escaped}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return decodeHtmlText(match[1].trim());
    }
    return null;
}

export function extractHtmlTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match?.[1]) return null;
    return decodeHtmlText(match[1].trim()).replace(/\s+-\s+YouTube$/i, '').trim() || null;
}

export function extractChannelTitleFromHtml(html: string): string | null {
    return extractMetaContent(html, 'og:title') ?? extractMetaContent(html, 'name') ?? extractHtmlTitle(html);
}

export function extractChannelUrlFromHtml(html: string, channelId: string): string {
    return extractMetaContent(html, 'og:url') ?? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}

export function extractFirstVideoFromHtml(html: string, author: string | null): PublicYouTubeVideo | null {
    const videoId = html.match(/"videoId":"([-_a-zA-Z0-9]{6,})"/)?.[1] ?? null;
    if (!videoId) return null;

    const videoIndex = html.indexOf(`"videoId":"${videoId}"`);
    const nearby = videoIndex >= 0 ? html.slice(videoIndex, videoIndex + 5000) : html;
    const title =
        nearby.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])+)"/)?.[1] ??
        nearby.match(/"title":\{"simpleText":"((?:\\.|[^"\\])+)"/)?.[1] ??
        null;

    return {
        videoId,
        title: title ? decodeHtmlText(title.replace(/\\"/g, '"').replace(/\\u0026/g, '&')) : null,
        author,
        link: `https://www.youtube.com/watch?v=${videoId}`,
    };
}

export async function fetchYouTubeChannelPageMetadata(channelId: string): Promise<PublicYouTubeChannelMetadata> {
    const url = `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
    const response = await fetch(url, {
        headers: {
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (compatible; fakegaming-bot/1.0)',
        },
    });
    if (!response.ok) {
        return { title: null, url: null, latestVideoId: null };
    }

    const html = await response.text();
    const title = extractChannelTitleFromHtml(html);
    const latestVideoId = extractFirstVideoFromHtml(html, title)?.videoId ?? null;
    return {
        title,
        url: extractChannelUrlFromHtml(html, channelId),
        latestVideoId,
    };
}

export async function fetchYouTubeChannelPageLatestVideo(channelId: string): Promise<PublicYouTubeVideo | null> {
    const url = `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/videos`;
    const response = await fetch(url, {
        headers: {
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (compatible; fakegaming-bot/1.0)',
        },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const title = extractChannelTitleFromHtml(html);
    return extractFirstVideoFromHtml(html, title);
}
