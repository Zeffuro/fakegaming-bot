export async function getTypedAsset<T>(
    url: string,
    fileName: string,
    cacheKey: string,
    cacheVar: { value: T | undefined }
): Promise<T> {
    if (cacheVar.value !== undefined) return cacheVar.value as T;
    const asset = await import('../utils/assetCache.js').then(m => m.getAsset(
        url,
        fileName,
        cacheKey
    ));
    if (!asset.buffer) {
        throw new Error(`Asset buffer for ${fileName} is null`);
    }
    cacheVar.value = JSON.parse(asset.buffer.toString());
    return cacheVar.value as T;
}