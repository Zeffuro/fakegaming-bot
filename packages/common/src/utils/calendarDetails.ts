import * as cheerio from 'cheerio';

export function googleCalendarEventLink(value: string | null | undefined): string | null {
    if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port
            || !['calendar.google.com', 'www.google.com'].includes(url.hostname)) return null;
        const eventQuery = /^\/calendar\/(?:event|render)$/.test(url.pathname)
            && /^[A-Za-z0-9_=-]+$/.test(url.searchParams.get('eid') ?? '');
        const eventPath = /^\/calendar\/(?:u\/\d+\/)?r\/event(?:edit)?\/[A-Za-z0-9_-]+$/.test(url.pathname);
        if (!eventQuery && !eventPath) return null;
        for (const key of [...url.searchParams.keys()]) if (!['eid', 'ctz'].includes(key)) url.searchParams.delete(key);
        url.hash = '';
        const normalized = url.toString();
        return normalized.length <= 2048 ? normalized : null;
    } catch { return null; }
}

export function calendarDetailText(value: string | null | undefined, limit: number, html = false): string | null {
    if (!value) return null;
    let text = value.slice(0, 100_000);
    if (html) {
        const $ = cheerio.load(text);
        $('script, style, iframe, object, embed').remove();
        $('br').replaceWith('\n');
        $('p, div, li, h1, h2, h3, h4, h5, h6').append('\n');
        text = $('body').text();
    }
    const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
        .replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n')
        .trim().replace(/@(?!\u200b)/gu, '@\u200b').slice(0, limit).trim();
    return clean || null;
}
