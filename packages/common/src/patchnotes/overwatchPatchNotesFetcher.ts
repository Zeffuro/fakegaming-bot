/// <reference path="../types/vendor.d.ts" />
import { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
import { PatchNoteConfig } from '../models/index.js';
import * as cheerio from 'cheerio';
import { parseDateToISO } from '../utils/time.js';

function trimPatchTitle(title: string): string {
    const match = title.match(/([A-Za-z]+\s\d{1,2},\s\d{4})/);
    return match ? match[1] : title;
}

export class OverwatchPatchNotesFetcher extends BasePatchNotesFetcher {
    constructor() {
        super('Overwatch 2', 0xFF8000);
    }

    getPatchNotesUrl(): string {
        return 'https://overwatch.blizzard.com/en-us/news/patch-notes/';
    }

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
        patchDiv.find('.PatchNotes-sectionDescription').each((_i: unknown, el: unknown) => {
            const t = $(el as any).text().trim();
            if (t) contentArr.push(t);
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
