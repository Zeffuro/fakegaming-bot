import { RiotPatchNotesFetcher } from './riotPatchNotesFetcher.js';

export class ValorantPatchNotesFetcher extends RiotPatchNotesFetcher {
    constructor() {
        super({
            game: 'VALORANT',
            accentColor: 0xFF4655,
            listUrl: 'https://playvalorant.com/en-us/news/tags/patch-notes/',
            baseUrl: 'https://playvalorant.com',
            logoUrl: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/cbf4460132cdfeb2a97fad5f9dd25ba0bc058f76-128x128.png?accountingTag=VAL',
            fullArticleBladeTypes: ['articleRichText']
        });
    }
}

