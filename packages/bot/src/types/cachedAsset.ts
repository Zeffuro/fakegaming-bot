/**
 * Represents a cached asset loaded from disk.
 * - buffer: The asset's buffer, or null if not loaded.
 * - path: The file path to the asset.
 */
export type CachedAsset = {
    buffer: Buffer | null;
    path: string;
};