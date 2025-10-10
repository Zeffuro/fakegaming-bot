import {BasePatchNotesFetcher} from './basePatchNotesFetcher.js';
import {PatchNoteConfig} from '@zeffuro/fakegaming-common/models';
import * as cheerio from 'cheerio';
import {parseDateToISO} from '@zeffuro/fakegaming-common/utils';

/**
 * Extracts the date portion from an Overwatch patch note title.
 * @param title The patch note title string.
 * @returns The extracted date string, or the original title if not found.
 */
function trimPatchTitle(title: string): string {
    const match = title.match(/([A-Za-z]+\s\d{1,2},\s\d{4})/);
    return match ? match[1] : title;
}

/**
 * Fetcher for Overwatch patch notes.
 * Implements game-specific parsing and enrichment logic.
 */
export class OverwatchPatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('Overwatch 2', 0xFF8000);
    }

    /**
     * Returns the URL to fetch Overwatch patch notes from.
     */
    getPatchNotesUrl(): string {
        return 'https://overwatch.blizzard.com/en-us/news/patch-notes/';
    }

    /**
     * Parses raw HTML into a PatchNoteConfig object for Overwatch.
     * @param raw Raw HTML response data.
     * @returns PatchNoteConfig or null if parsing fails.
     */
    parsePatchNotes(raw: string): PatchNoteConfig | null {
        const $ = cheerio.load(raw);
        const patchDiv = $('.PatchNotes-patch.PatchNotes-live').first();
        if (!patchDiv.length) return null;

        const dateText = patchDiv.find('.PatchNotes-date').first().text().trim();
        const isoDate = parseDateToISO(dateText);
        if (!isoDate) return null;

        const rawTitle = patchDiv.find('.PatchNotes-patchTitle').first().text().trim();
        const title = trimPatchTitle(rawTitle);
        if (!title) return null;

        const sectionTitle = patchDiv.find('.PatchNotes-sectionTitle').first().text().trim();
        const sectionTitleBlock = sectionTitle ? `**${sectionTitle}**\n` : '';

        const contentArr: string[] = [];
        patchDiv.find('.PatchNotes-sectionDescription').each((_, el) => {
            contentArr.push($(el).text().trim());
        });
        const content = sectionTitleBlock + contentArr.join('\n\n');
        if (!content) return null;

        const publishedAt = new Date(dateText).getTime() || Date.now();

        return PatchNoteConfig.build({
            game: this.game,
            title,
            content,
            url: this.getPatchNotesUrl(),
            publishedAt,
            logoUrl: 'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Overwatch_2_logo.webp',
            imageUrl: undefined,
            version: isoDate
        });
    }
}