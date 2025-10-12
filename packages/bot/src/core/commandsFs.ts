import fs from 'fs';
import path from 'path';

/**
 * Safely read a directory; returns an empty array if the path doesn't exist,
 * the mock returns undefined, or an error occurs.
 */
function safeReadDir(dir: string): string[] {
    try {
        const entries = fs.readdirSync(dir) as unknown;
        if (Array.isArray(entries)) {
            // Ensure string[] regardless of Buffer[] or mixed types in mocks
            return entries.map((e) => String(e));
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Recursively collects command file paths under modules/[module]/commands with .js or .ts extensions.
 */
export function findCommandFiles(modulesPath: string): string[] {
    if (!fs.existsSync(modulesPath)) return [];
    const moduleFolders = safeReadDir(modulesPath);
    const results: string[] = [];
    for (const folder of moduleFolders) {
        const commandsPath = path.join(modulesPath, folder, 'commands');
        if (!fs.existsSync(commandsPath)) continue;
        const entries = safeReadDir(commandsPath);
        const commandFiles = entries
            .filter((file) => typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.ts')))
            .map((file) => path.join(commandsPath, file));
        results.push(...commandFiles);
    }
    return results;
}
