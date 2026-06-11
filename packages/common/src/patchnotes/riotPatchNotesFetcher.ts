import { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../models/index.js';
import * as cheerio from 'cheerio';
import { cleanDiscordContent } from '../utils/text.js';
import { htmlToDiscordText } from './formatting.js';

interface RiotPatchNotesFetcherOptions {
    game: string;
    accentColor: number;
    listUrl: string;
    baseUrl: string;
    logoUrl: string;
    fullArticleBladeTypes: readonly string[];
}

interface RiotArticleItem {
    title?: string;
    description?: {
        body?: string;
    };
    action?: {
        payload?: {
            url?: string;
        };
    };
    publishedAt?: string;
    media?: {
        url?: string;
    };
    imageMedia?: {
        url?: string;
    };
}

function getNextData(raw: string): Record<string, unknown> | null {
    const $ = cheerio.load(raw);
    const nextData = $('#__NEXT_DATA__').html();
    if (!nextData) return null;

    try {
        return JSON.parse(nextData) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getPageBlades(data: Record<string, unknown>): Record<string, unknown>[] {
    const props = data.props as Record<string, unknown> | undefined;
    const pageProps = props?.pageProps as Record<string, unknown> | undefined;
    const page = pageProps?.page as Record<string, unknown> | undefined;
    const blades = page?.blades;
    return Array.isArray(blades) ? blades as Record<string, unknown>[] : [];
}

function getArticleGridItems(data: Record<string, unknown>): RiotArticleItem[] {
    const articleGrid = getPageBlades(data).find((blade) => blade.type === 'articleCardGrid');
    const items = articleGrid?.items;
    return Array.isArray(items) ? items as RiotArticleItem[] : [];
}

function joinUrl(baseUrl: string, url: string): string {
    return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export abstract class RiotPatchNotesFetcher extends BasePatchNotesFetcher<string> {
    private readonly listUrl: string;
    private readonly baseUrl: string;
    private readonly logoUrl: string;
    private readonly fullArticleBladeTypes: readonly string[];

    protected constructor(options: RiotPatchNotesFetcherOptions) {
        super(options.game, options.accentColor);
        this.listUrl = options.listUrl;
        this.baseUrl = options.baseUrl;
        this.logoUrl = options.logoUrl;
        this.fullArticleBladeTypes = options.fullArticleBladeTypes;
    }

    getPatchNotesUrl(): string {
        return this.listUrl;
    }

    protected getVersionFromTitle(title: string): string | undefined {
        const match = title.match(/Patch(?:\s+Notes)?\s+([\d.]+)/i);
        return match?.[1];
    }

    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const data = getNextData(raw);
        if (!data) return null;

        const latestPatch = getArticleGridItems(data)[0];
        if (!latestPatch) return null;

        const title = latestPatch.title;
        const url = latestPatch.action?.payload?.url;
        const content = latestPatch.description?.body;
        if (!title || !url || !content) return null;

        const fullUrl = joinUrl(this.baseUrl, url);
        const version = this.getVersionFromTitle(title) ?? title.replace(/\s+Notes$/i, '');
        const publishedAt = latestPatch.publishedAt ? new Date(latestPatch.publishedAt).getTime() : Date.now();

        return PatchNoteConfig.build({
            game: this.game,
            title,
            content: cleanDiscordContent(content),
            url: fullUrl,
            publishedAt,
            logoUrl: this.logoUrl,
            imageUrl: latestPatch.imageMedia?.url ?? latestPatch.media?.url,
            version
        });
    }

    async fetchFullPatchContent(url: string): Promise<{ content: string; fullImage?: string } | null> {
        const f: ((u: string) => Promise<Response>) | undefined = (globalThis as { fetch?: (u: string) => Promise<Response> }).fetch;
        if (!f) return null;

        const res = await f(url);
        const html = await res.text();
        const data = getNextData(html);
        if (!data) return null;

        const richTextBlade = getPageBlades(data).find((blade) => {
            return typeof blade.type === 'string' && this.fullArticleBladeTypes.includes(blade.type);
        });
        const richText = richTextBlade?.richText as { body?: string } | undefined;
        if (!richText?.body) return null;

        return {
            content: htmlToDiscordText(richText.body),
            fullImage: this.getFullArticleImage(richText.body)
        };
    }

    protected getFullArticleImage(_richTextHtml: string): string | undefined {
        return undefined;
    }
}

