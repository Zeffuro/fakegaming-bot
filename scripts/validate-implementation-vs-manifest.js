import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getModulesPath, findModuleFolders, listImplementationCommands } from './lib/command-introspection.js';
// Resolve project root
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function main() {
    // Load generated manifest from source (TS) so tsx can import it directly
    const manifestPath = path.join(PROJECT_ROOT, 'packages/common/src/manifest/bot-manifest.ts');
    if (!fs.existsSync(manifestPath)) {
        console.error(`ERROR: Manifest not found at ${manifestPath}. Run: pnpm run gen:manifest`);
        process.exit(1);
        return;
    }
    const mod = (await import(pathToFileURL(manifestPath).href));
    const fromManifest = new Set((mod.BOT_COMMANDS ?? []).map(c => c.name));
    // Read implementation commands from bot sources
    const modulesPath = getModulesPath(PROJECT_ROOT);
    const moduleFolders = findModuleFolders(modulesPath);
    const fromImpl = new Set();
    for (const m of moduleFolders) {
        const names = await listImplementationCommands(path.join(modulesPath, m));
        for (const n of names)
            fromImpl.add(n);
    }
    const missingImpl = [];
    for (const n of fromManifest) {
        if (!fromImpl.has(n))
            missingImpl.push(n);
    }
    const missingManifest = [];
    for (const n of fromImpl) {
        if (!fromManifest.has(n))
            missingManifest.push(n);
    }
    if (missingImpl.length || missingManifest.length) {
        if (missingImpl.length)
            console.error('Commands in manifest but no implementation:', missingImpl.sort().join(', '));
        if (missingManifest.length)
            console.error('Commands implemented but missing in manifest:', missingManifest.sort().join(', '));
        process.exit(1);
        return;
    }
    console.log(`Implementation vs manifest validation passed. ${fromManifest.size} commands in sync.`);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
