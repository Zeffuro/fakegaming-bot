// src/services/patchfetchers/marvelRivalsPatchNotesFetcher.ts
import {BasePatchNotesFetcher} from './basePatchNotesFetcher.js';
import {PatchNoteConfig} from '../../models/patch-note-config.js';
import * as cheerio from 'cheerio';

/**
 * Fetcher for Marvel Rivals patch notes.
 * Implements game-specific parsing and enrichment logic.
 */
export class MarvelRivalsPatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('Marvel Rivals', 0xFBDC2C);
    }

    /**
     * Returns the main patch notes URL.
     */
    getPatchNotesUrl(): string {
        return 'https://www.marvelrivals.com/gameupdate/';
    }

    /**
     * Returns all URLs to check for patch notes.
     */
    getPatchNotesUrls(): string[] {
        return [
            'https://www.marvelrivals.com/gameupdate/',
            'https://www.marvelrivals.com/balancepost/'
        ];
    }

    /**
     * Parses raw HTML into a PatchNoteConfig object for Marvel Rivals.
     * @param raw Raw HTML response data.
     * @returns PatchNoteConfig or null if parsing fails.
     */
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

    /**
     * Returns the version string from the parsed patch note.
     * @param _raw Raw response data.
     * @param patchNote Parsed patch note config.
     */
    getVersion(_raw: any, patchNote?: PatchNoteConfig): string | undefined {
        return patchNote?.version;
    }
}