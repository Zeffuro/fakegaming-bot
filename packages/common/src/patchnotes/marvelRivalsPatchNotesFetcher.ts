import { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../models/index.js';
import * as cheerio from 'cheerio';
import { cleanDiscordContent } from '../utils/text.js';
import { htmlToDiscordText } from './formatting.js';

type LoadedCheerio = ReturnType<typeof cheerio.load>;
type CheerioElement = Parameters<LoadedCheerio>[0];

function parseYyyyMmDdToMs(value: string | undefined): number {
    if (!value) return Date.now();
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return Date.now();

    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export class MarvelRivalsPatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('Marvel Rivals', 0xFBDC2C);
    }

    getPatchNotesUrl(): string {
        return 'https://www.marvelrivals.com/gameupdate/';
    }

    getPatchNotesUrls(): string[] {
        return [
            'https://www.marvelrivals.com/gameupdate/',
            'https://www.marvelrivals.com/balancepost/'
        ];
    }

    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const $ = cheerio.load(raw);
        const listItem = $('.cont-box .list-item').first();
        if (!listItem.length) return null;

        const url = listItem.attr('href');
        const img = listItem.find('img').attr('src');
        const title = listItem.find('.text h2').text().trim();
        const content = cleanDiscordContent(listItem.find('.text p').text());

        const versionMatch = title.match(/Version\s(\d{8})/);
        const version = versionMatch ? versionMatch[1] : undefined;

        if (!url || !title || !content || !version) return null;

        return PatchNoteConfig.build({
            game: this.game,
            title,
            content,
            url: url.startsWith('http') ? url : `https://www.marvelrivals.com${url}`,
            publishedAt: parseYyyyMmDdToMs(url.match(/\/(\d{8})\//)?.[1]),
            logoUrl: 'https://www.marvelrivals.com/pc/gw/20241128194803/img/logo_ad22b142.png',
            imageUrl: img,
            version
        });
    }

    getVersion(_raw: string, patchNote?: PatchNoteConfig): string | undefined {
        return patchNote?.version;
    }

    async fetchFullPatchContent(url: string): Promise<{ content: string; fullImage?: string } | null> {
        const html = await this.fetchUrlText(url);
        if (!html) return null;

        const $ = cheerio.load(html);
        const article = $('.artText').first();
        if (!article.length) return null;

        const socialLinks = article.find('p').filter((_index: number, element: CheerioElement) => {
            const text = cleanDiscordContent($(element).text());
            return text === 'Discord|X|Facebook|Instagram|TikTok|YouTube|Twitch';
        });
        socialLinks.remove();

        return {
            content: htmlToDiscordText(article.html() ?? '')
        };
    }
}
