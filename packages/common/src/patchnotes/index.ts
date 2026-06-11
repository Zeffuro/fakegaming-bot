import { LeaguePatchNotesFetcher } from './leaguePatchNotesFetcher.js';
import { OverwatchPatchNotesFetcher } from './overwatchPatchNotesFetcher.js';
import { MarvelRivalsPatchNotesFetcher } from './marvelRivalsPatchNotesFetcher.js';
import { ValorantPatchNotesFetcher } from './valorantPatchNotesFetcher.js';
export { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
export { RiotPatchNotesFetcher } from './riotPatchNotesFetcher.js';
export { LeaguePatchNotesFetcher } from './leaguePatchNotesFetcher.js';
export { OverwatchPatchNotesFetcher } from './overwatchPatchNotesFetcher.js';
export { MarvelRivalsPatchNotesFetcher } from './marvelRivalsPatchNotesFetcher.js';
export { ValorantPatchNotesFetcher } from './valorantPatchNotesFetcher.js';
export { htmlToDiscordText, formatPatchNoteEmbedDescription, PATCH_NOTE_EMBED_DESCRIPTION_LIMIT } from './formatting.js';

/**
 * Factory returning the default set of patch note fetchers supported by the project.
 */
export function getDefaultPatchNoteFetchers() {
    return [
        new LeaguePatchNotesFetcher(),
        new ValorantPatchNotesFetcher(),
        new MarvelRivalsPatchNotesFetcher(),
        new OverwatchPatchNotesFetcher(),
    ];
}
