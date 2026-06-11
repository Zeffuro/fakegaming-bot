import * as cheerio from 'cheerio';
import { RiotPatchNotesFetcher } from './riotPatchNotesFetcher.js';

export class LeaguePatchNotesFetcher extends RiotPatchNotesFetcher {
    constructor() {
        super({
            game: 'League of Legends',
            accentColor: 0xC89B3C,
            listUrl: 'https://www.leagueoflegends.com/en-us/news/tags/patch-notes/',
            baseUrl: 'https://www.leagueoflegends.com',
            logoUrl: 'https://wiki.leagueoflegends.com/en-us/images/League_of_Legends_Icon.png',
            fullArticleBladeTypes: ['patchNotesRichText', 'articleRichText']
        });
    }

    protected getFullArticleImage(richTextHtml: string): string | undefined {
        const $ = cheerio.load(richTextHtml);
        return $('#patch-patch-highlights').parent().next('.content-border').find('img').attr('src');
    }
}
