import {BasePatchNotesFetcher} from './basePatchNotesFetcher.js';
import {PatchNoteConfig} from '@zeffuro/fakegaming-common/dist/models/patch-note-config.js';
import * as cheerio from 'cheerio';
import axios from 'axios';
import {cleanDiscordContent} from '../../utils/generalUtils.js';

/**
 * Fetcher for League of Legends patch notes.
 * Implements game-specific parsing and enrichment logic.
 */
export class LeaguePatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('League of Legends', 0xC89B3C);
    }

    /**
     * Returns the URL to fetch League patch notes from.
     */
    getPatchNotesUrl(): string {
        return 'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/';
    }

    /**
     * Fetches and parses the full patch content from a patch note URL.
     * @param url Patch note URL
     * @returns Content and highlight image, or null
     */
    async fetchFullPatchContent(url: string): Promise<{ content: string, fullImage?: string } | null> {
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) return null;

        const data = JSON.parse(nextData);
        const richTextHtml = data?.props?.pageProps?.page?.blades?.find((b: any) => b.type === 'patchNotesRichText')?.richText?.body;
        if (!richTextHtml) return null;

        const $$ = cheerio.load(richTextHtml);
        const blockquote = $$('#patch-notes-container blockquote').first().text().trim();
        const fullImage = $$('#patch-patch-highlights').parent().next('.content-border').find('img').attr('src');

        return {
            content: cleanDiscordContent(blockquote),
            fullImage
        };
    }

    /**
     * Parses raw HTML into a PatchNoteConfig object for League.
     * @param raw Raw HTML response data
     * @returns PatchNoteConfig or null if parsing fails
     */
    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const $ = cheerio.load(raw);
        const nextData = $('#__NEXT_DATA__').html();
        if (!nextData) return null;

        const data = JSON.parse(nextData);
        const blades = data?.props?.pageProps?.page?.blades;
        if (!Array.isArray(blades)) return null;

        const articleGrid = blades.find((b: any) => b.type === 'articleCardGrid');
        if (!articleGrid || !Array.isArray(articleGrid.items) || articleGrid.items.length === 0) return null;

        const latestPatch = articleGrid.items[0];
        const title = latestPatch?.title;
        const url = latestPatch?.action?.payload?.url;
        const content = latestPatch?.description?.body;
        const publishedAt = latestPatch?.publishedAt ? new Date(latestPatch.publishedAt).getTime() : Date.now();
        const imageUrl = latestPatch?.media?.url;

        if (!title || !url || !content) return null;

        const fullUrl = url.startsWith('http') ? url : `https://www.leagueoflegends.com${url}`;
        const versionMatch = title.match(/Patch\s([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : title.replace(' Notes', '');

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