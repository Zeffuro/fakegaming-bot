import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {BasePatchNotesFetcher} from '../services/patchfetchers/basePatchNotesFetcher.js';
import {bootstrapEnv} from "../core/bootstrapEnv.js";

const {__dirname} = bootstrapEnv(import.meta.url);

/**
 * Dynamically loads all patch note fetchers from the patchfetchers directory.
 */
export async function loadPatchNoteFetchers(): Promise<BasePatchNotesFetcher[]> {
    const fetchersDir = path.join(__dirname, '..', 'services', 'patchfetchers');
    
    const files = fs.readdirSync(fetchersDir)
        .filter(file =>
            (file.endsWith('Fetcher.js') || file.endsWith('Fetcher.ts')) &&
            !file.startsWith('basePatchNotesFetcher')
        )
        .map(file => pathToFileURL(path.join(fetchersDir, file)).href);

    const fetchers: BasePatchNotesFetcher[] = [];

    for (const fileUrl of files) {
        try {
            const module = await import(fileUrl);
            let FetcherClass = null;

            for (const key in module) {
                const exported = module[key];
                if (typeof exported === 'function' && exported.prototype?.getPatchNotesUrl) {
                    FetcherClass = exported;
                    break;
                }
            }

            if (FetcherClass) {
                fetchers.push(new FetcherClass());
            }
        } catch (e) {
            console.error(`Failed to load fetcher from ${fileUrl}:`, e);
        }
    }

    return fetchers;
}