import { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../models/index.js';
import * as cheerio from 'cheerio';

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
        const content = listItem.find('.text p').text().trim();

        const versionMatch = title.match(/Version\s(\d{8})/);
        const version = versionMatch ? versionMatch[1] : undefined;

        if (!url || !title || !content || !version) return null;

        return PatchNoteConfig.build({
            game: this.game,
            title,
            content,
            url: url.startsWith('http') ? url : `https://www.marvelrivals.com${url}`,
            publishedAt: Date.now(),
            logoUrl: 'https://www.marvelrivals.com/pc/gw/20241128194803/img/logo_ad22b142.png',
            imageUrl: img,
            version
        });
    }

    getVersion(_raw: string, patchNote?: PatchNoteConfig): string | undefined {
        return patchNote?.version;
    }
}

