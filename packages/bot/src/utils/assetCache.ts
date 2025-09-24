import {CachedAsset} from '../types/cachedAsset.js';
import {resolveDataRoot} from "@zeffuro/fakegaming-common/dist/core/dataRoot.js";
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const dataRoot = resolveDataRoot();
const assetRoot = path.join(dataRoot, 'assets');

/**
 * Gets the cache directory for a given asset type, creating it if it does not exist.
 * Returns the absolute path to the cache directory.
 */
export function getAssetCacheDir(type: string): string {
    const dir = path.join(assetRoot, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    return dir;
}

/**
 * Retrieves an asset from the cache or downloads it if not present.
 * Returns a CachedAsset object with buffer and path.
 */
export async function getAsset(assetUrl: string, assetName: string, type: string): Promise<CachedAsset> {
    const cacheDir = getAssetCacheDir(type);
    const cachePath = path.join(cacheDir, assetName);
    if (fs.existsSync(cachePath)) {
        const buffer = await fs.promises.readFile(cachePath);
        return {buffer, path: cachePath};
    }
    try {
        const response = await axios.get(assetUrl, {responseType: 'arraybuffer'});
        await fs.promises.writeFile(cachePath, response.data);
        return {buffer: response.data, path: cachePath};
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to fetch asset: ${assetUrl}`, errorMsg);
        return {buffer: null, path: cachePath};
    }
}