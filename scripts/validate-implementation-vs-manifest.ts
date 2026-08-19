import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
    findModuleFolders,
    getModulesPath,
    listImplementationCommandMetadata,
    type CommandKind,
    type ImplementationCommandMetadata,
} from './lib/command-introspection.js';

// Resolve project root
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
    // Load generated manifest from source (TS) so tsx can import it directly
    const manifestPath = path.join(PROJECT_ROOT, 'packages/common/src/manifest/bot-manifest.ts');
    if (!fs.existsSync(manifestPath)) {
        console.error(`ERROR: Manifest not found at ${manifestPath}. Run: pnpm run gen:manifest`);
        process.exit(1);
        return;
    }
    interface ManifestCommand {
        name: string;
        dm_permission?: boolean | null;
        default_member_permissions?: string | null;
        type?: CommandKind | null;
    }
    type ManifestMod = { BOT_COMMANDS?: ReadonlyArray<ManifestCommand>; };
    const mod = (await import(pathToFileURL(manifestPath).href)) as ManifestMod;
    const manifestCommands = mod.BOT_COMMANDS ?? [];
    const fromManifest = new Set<string>(manifestCommands.map(c => c.name));

    // Read implementation commands from bot sources
    const modulesPath = getModulesPath(PROJECT_ROOT);
    const moduleFolders = findModuleFolders(modulesPath);
    const fromImpl = new Set<string>();
    const implementationByName = new Map<string, ImplementationCommandMetadata>();
    const duplicateImplementations: string[] = [];
    for (const m of moduleFolders) {
        const commands = await listImplementationCommandMetadata(path.join(modulesPath, m));
        for (const command of commands) {
            if (implementationByName.has(command.name)) duplicateImplementations.push(command.name);
            implementationByName.set(command.name, command);
            fromImpl.add(command.name);
        }
    }

    const missingImpl: string[] = [];
    for (const n of fromManifest) {
        if (!fromImpl.has(n)) missingImpl.push(n);
    }
    const missingManifest: string[] = [];
    for (const n of fromImpl) {
        if (!fromManifest.has(n)) missingManifest.push(n);
    }

    const metadataMismatches = manifestCommands.flatMap(command => {
        const implementation = implementationByName.get(command.name);
        if (!implementation) return [];

        const mismatches: string[] = [];
        if (command.default_member_permissions != null
            && command.default_member_permissions !== implementation.default_member_permissions) {
            mismatches.push(
                `${command.name}: default_member_permissions is ${implementation.default_member_permissions ?? 'null'} in the implementation, expected ${command.default_member_permissions}`,
            );
        }
        if (command.dm_permission != null && command.dm_permission !== implementation.dm_permission) {
            mismatches.push(
                `${command.name}: dm_permission is ${implementation.dm_permission ?? 'null'} in the implementation, expected ${command.dm_permission}`,
            );
        }
        if (command.type != null && command.type !== implementation.type) {
            mismatches.push(`${command.name}: type is ${implementation.type} in the implementation, expected ${command.type}`);
        }
        return mismatches;
    });

    if (missingImpl.length || missingManifest.length || duplicateImplementations.length || metadataMismatches.length) {
        if (missingImpl.length) console.error('Commands in manifest but no implementation:', missingImpl.sort().join(', '));
        if (missingManifest.length) console.error('Commands implemented but missing in manifest:', missingManifest.sort().join(', '));
        if (duplicateImplementations.length) console.error('Duplicate implementation command names:', duplicateImplementations.sort().join(', '));
        for (const mismatch of metadataMismatches) console.error('Command metadata mismatch:', mismatch);
        process.exit(1);
        return;
    }

    console.log(`Implementation vs manifest validation passed. ${fromManifest.size} commands in sync.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
