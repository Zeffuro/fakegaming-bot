import { REST } from 'discord.js';
import fs from 'fs';
import path from 'path';

type AppEmoji = { id: string; name: string };

const cache = new Map<string, string>(); // name(lowercase) -> id

function getRest(): REST {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) throw new Error('DISCORD_BOT_TOKEN is not set');
    return new REST({ version: '10' }).setToken(token);
}

function getApplicationId(): string {
    const id = process.env.CLIENT_ID;
    if (!id) throw new Error('CLIENT_ID is not set');
    return id;
}

/**
 * Load application emojis into an in-memory cache (name -> id).
 */
export async function loadApplicationEmojiCache(): Promise<void> {
    try {
        const rest = getRest();
        const appId = getApplicationId();
        const emojis = await rest.get(`/applications/${appId}/emojis`) as Array<{ id: string; name: string }>;
        cache.clear();
        for (const e of emojis) {
            if (e.name && e.id) cache.set(e.name.toLowerCase(), e.id);
        }
    } catch {
        // Ignore; cache stays as-is
    }
}

/**
 * Get an application emoji ID by name (case-insensitive) from the cache.
 */
export function getAppEmojiId(name: string): string | undefined {
    return cache.get(name.toLowerCase());
}

function fileToDataUri(absFile: string): string {
    const buf = fs.readFileSync(absFile);
    const ext = path.extname(absFile).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.avif' ? 'image/avif' : 'application/octet-stream';
    const base64 = buf.toString('base64');
    return `data:${mime};base64,${base64}`;
}

/**
 * Ensure application emojis exist for the given names by reading files from a directory.
 * - Each file must be named exactly as the emoji name (e.g., lolgold.png) or name.<ext>.
 * - Only creates missing emojis; does not modify existing ones.
 */
export async function syncApplicationEmojisFromDir(dir: string, names: string[]): Promise<void> {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    const rest = getRest();
    const appId = getApplicationId();

    // Refresh cache first
    await loadApplicationEmojiCache();

    for (const name of names) {
        const lc = name.toLowerCase();
        if (cache.has(lc)) continue; // already exists

        // Find a matching file by name with supported extensions
        const candidates = ['.png', '.webp', '.gif', '.jpg', '.jpeg', '.avif'].map(ext => path.join(dir, `${name}${ext}`));
        const file = candidates.find(p => fs.existsSync(p));
        if (!file) continue;

        try {
            const image = fileToDataUri(file);
            const created = await rest.post(`/applications/${appId}/emojis`, { body: { name, image } }) as AppEmoji;
            cache.set(lc, created.id);
        } catch {
            // Ignore individual failures (size limits/validation/rate limits)
        }
    }
}

