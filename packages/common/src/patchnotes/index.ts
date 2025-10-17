import { LeaguePatchNotesFetcher } from './leaguePatchNotesFetcher.js';
import { OverwatchPatchNotesFetcher } from './overwatchPatchNotesFetcher.js';
import { MarvelRivalsPatchNotesFetcher } from './marvelRivalsPatchNotesFetcher.js';
export { BasePatchNotesFetcher } from './basePatchNotesFetcher.js';
export { LeaguePatchNotesFetcher } from './leaguePatchNotesFetcher.js';
export { OverwatchPatchNotesFetcher } from './overwatchPatchNotesFetcher.js';
export { MarvelRivalsPatchNotesFetcher } from './marvelRivalsPatchNotesFetcher.js';

/**
 * Factory returning the default set of patch note fetchers supported by the project.
 */
export function getDefaultPatchNoteFetchers() {
    return [
        new LeaguePatchNotesFetcher(),
        new MarvelRivalsPatchNotesFetcher(),
        new OverwatchPatchNotesFetcher(),
    ];
}
