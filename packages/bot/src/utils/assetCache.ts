import {CachedAsset} from '../types/cachedAsset.js';
import {resolveDataRoot} from "@zeffuro/fakegaming-common/core";
import {getLogger} from '@zeffuro/fakegaming-common';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const dataRoot = resolveDataRoot();
const assetRoot = path.join(dataRoot, 'assets');
const log = getLogger({ name: 'bot:assetCache' });

export function getAssetCacheDir(type: string): string {
    const dir = path.join(assetRoot, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    return dir;
}

export async function getAsset(assetUrl: string, assetName: string, type: string, options: { logFailures?: boolean } = {}): Promise<CachedAsset> {
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
        if (options.logFailures ?? true) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.warn({ err: errorMsg, assetName, type }, 'Failed to fetch asset');
        }
        return {buffer: null, path: cachePath};
    }
}
