import {CachedAsset} from '../types/cachedAsset.js';
import {resolveDataRoot} from "@zeffuro/fakegaming-common/core";
import {getLogger} from '@zeffuro/fakegaming-common';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const dataRoot = resolveDataRoot();
const assetRoot = path.join(dataRoot, 'assets');
const log = getLogger({ name: 'bot:assetCache' });
type AssetResponseData = Buffer | ArrayBuffer | ArrayBufferView | string;

export function getAssetCacheDir(type: string): string {
    const dir = path.join(assetRoot, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    return dir;
}

function toBuffer(data: AssetResponseData): Buffer {
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') return Buffer.from(data);
    if (data instanceof ArrayBuffer) return Buffer.from(data);

    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return Buffer.from(view);
}

export async function getAsset(assetUrl: string, assetName: string, type: string, options: { logFailures?: boolean } = {}): Promise<CachedAsset> {
    const cacheDir = getAssetCacheDir(type);
    const cachePath = path.join(cacheDir, assetName);
    if (fs.existsSync(cachePath)) {
        const buffer = await fs.promises.readFile(cachePath);
        return {buffer, path: cachePath};
    }
    try {
        const response = await axios.get<AssetResponseData>(assetUrl, {responseType: 'arraybuffer'});
        const buffer = toBuffer(response.data);
        await fs.promises.writeFile(cachePath, buffer);
        return {buffer, path: cachePath};
    } catch (error) {
        if (options.logFailures ?? true) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.warn({ err: errorMsg, assetName, type }, 'Failed to fetch asset');
        }
        return {buffer: null, path: cachePath};
    }
}
