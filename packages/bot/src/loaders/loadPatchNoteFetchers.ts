import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {BasePatchNotesFetcher} from '../services/patchfetchers/basePatchNotesFetcher.js';
import {bootstrapEnv} from "@zeffuro/fakegaming-common/core";

const {__dirname} = bootstrapEnv(import.meta.url);

/**
 * Function signature for dynamic imports, overridable in tests.
 */
export type DynamicImporter = (moduleUrl: string) => Promise<Record<string, unknown>>;

/**
 * Dynamically loads all patch note fetchers from the patchfetchers directory.
 * Accepts an optional dynamic importer to aid testing without real dynamic imports.
 */
export async function loadPatchNoteFetchers(importer?: DynamicImporter): Promise<BasePatchNotesFetcher[]> {
    const fetchersDir = path.join(__dirname, '..', 'services', 'patchfetchers');

    const files = fs.readdirSync(fetchersDir)
        .filter(file =>
            (file.endsWith('Fetcher.js') || file.endsWith('Fetcher.ts')) &&
            !file.startsWith('basePatchNotesFetcher')
        )
        .map(file => pathToFileURL(path.join(fetchersDir, file)).href);

    const fetchers: BasePatchNotesFetcher[] = [];
    const dynamicImport: DynamicImporter = importer ?? (async (url: string) => import(url));

    for (const fileUrl of files) {
        try {
            const module = await dynamicImport(fileUrl);
            let FetcherClass: (new () => BasePatchNotesFetcher) | null = null;

            for (const key in module) {
                const exported = (module as Record<string, unknown>)[key];
                if (typeof exported === 'function' && (exported as any).prototype?.getPatchNotesUrl) {
                    FetcherClass = exported as unknown as new () => BasePatchNotesFetcher;
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