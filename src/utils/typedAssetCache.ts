/**
 * Loads and caches a typed asset from a buffer, using the provided cache variable.
 * @template T The type of the asset to load.
 * @param url The URL to load the asset from.
 * @param fileName The name of the asset file.
 * @param cacheKey The key to use for caching.
 * @param cacheVar An object holding the cached value.
 * @returns The loaded and parsed asset of type T.
 * @throws If the asset buffer is null.
 */
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