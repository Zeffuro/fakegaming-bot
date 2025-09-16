import {fileURLToPath} from 'url';
import {CachedAsset} from '../types/cachedAsset.js';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataRoot = process.env.DATA_ROOT || path.join(__dirname, '..', '..', 'data');
const assetRoot = path.join(dataRoot, 'assets');

export function getAssetCacheDir(type: string): string {
    const dir = path.join(assetRoot, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    return dir;
}

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