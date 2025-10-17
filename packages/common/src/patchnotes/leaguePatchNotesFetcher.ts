import { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../models/index.js';
import * as cheerio from 'cheerio';
import { cleanDiscordContent } from '../utils/text.js';

/**
 * Fetcher for League of Legends patch notes.
 * Implements game-specific parsing and enrichment logic.
 */
export class LeaguePatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('League of Legends', 0xC89B3C);
    }

    getPatchNotesUrl(): string {
        return 'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/';
    }

    async fetchFullPatchContent(url: string): Promise<{ content: string; fullImage?: string } | null> {
        const f: ((u: string) => Promise<any>) | undefined = (globalThis as any).fetch;
        if (!f) return null;
        const res = await f(url);
        const html = await res.text();
        const $ = cheerio.load(html);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) return null;

        const data = JSON.parse(nextData);
        const richTextHtml = data?.props?.pageProps?.page?.blades?.find((b: Record<string, unknown>) => b.type === 'patchNotesRichText')?.richText?.body;
        if (!richTextHtml) return null;

        const $$ = cheerio.load(richTextHtml);
        const blockquote = $$('#patch-notes-container blockquote').first().text().trim();
        const fullImage = $$('#patch-patch-highlights').parent().next('.content-border').find('img').attr('src');

        return {
            content: cleanDiscordContent(blockquote),
            fullImage
        };
    }

    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const $ = cheerio.load(raw);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) return null;

        const data = JSON.parse(nextData);
        const blades = data?.props?.pageProps?.page?.blades;
        if (!Array.isArray(blades)) return null;

        const articleGrid = blades.find((b: Record<string, unknown>) => b.type === 'articleCardGrid');
        if (!articleGrid || !Array.isArray(articleGrid.items) || articleGrid.items.length === 0) return null;

        const latestPatch = (articleGrid.items as Record<string, unknown>[])[0] as Record<string, unknown>;
        const title = latestPatch?.title as string;
        const payload = (latestPatch?.action as { payload?: { url?: string } })?.payload;
        const url = payload?.url as string | undefined;
        const content = (latestPatch?.description as Record<string, unknown>)?.body as string;
        const publishedAt = latestPatch?.publishedAt ? new Date(latestPatch.publishedAt as string).getTime() : Date.now();
        const imageUrl = (latestPatch?.media as Record<string, unknown>)?.url as string;

        if (!title || !url || !content) return null;

        const fullUrl = url.startsWith('http') ? url : `https://www.leagueoflegends.com${url ?? ''}`;
        const versionMatch = (title as string).match(/Patch\s([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : (title as string).replace(' Notes', '');

        return PatchNoteConfig.build({
            game: this.game,
            title,
            content,
            url: fullUrl,
            publishedAt,
            logoUrl: 'https://wiki.leagueoflegends.com/en-us/images/League_of_Legends_Icon.png',
            imageUrl,
            version
        });
    }
}
