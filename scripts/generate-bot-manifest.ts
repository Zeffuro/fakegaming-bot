import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    getModulesPath,
    findModuleFolders,
    loadModuleMeta,
    titleize,
    findCommandFiles,
    loadCommands,
    type CommandOut,
} from './lib/command-introspection.js';

// Compute project root based on this script location (repoRoot/scripts/..)
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface ModuleOut { name: string; title: string; description: string; hidden?: boolean | null; sortOrder?: number | null; }

async function main() {
    const modulesPath = getModulesPath(PROJECT_ROOT);
    const moduleFolders = findModuleFolders(modulesPath);

    const modules: ModuleOut[] = [];
    const commandsByModule: Record<string, CommandOut[]> = {};

    for (const name of moduleFolders) {
        const modPath = path.join(modulesPath, name);
        const meta = loadModuleMeta(modPath);
        const info: ModuleOut = {
            name,
            title: meta?.title ?? titleize(name),
            description: meta?.description ?? `${titleize(name)} module`,
            hidden: meta?.hidden ?? null,
            sortOrder: meta?.sortOrder ?? null,
        };
        modules.push(info);

        const cmdDir = path.join(modulesPath, name, 'commands');
        const files = findCommandFiles(cmdDir);
        const res = await loadCommands(name, modPath, files, { allowFallback: true });
        commandsByModule[name] = res.commands;
    }

    // Sort modules by sortOrder then title
    modules.sort((a, b) => {
        const ao = a.sortOrder ?? 0; const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return a.title.localeCompare(b.title);
    });

    // Build hierarchical tree while honoring hidden flags
    const tree = modules
        .filter(m => !m.hidden)
        .map(m => ({
            module: { name: m.name, title: m.title, description: m.description },
            commands: (commandsByModule[m.name] ?? []).filter(c => !c.hidden).map(c => ({
                name: c.name,
                description: c.description,
                module: c.module ?? m.name,
                permissions: c.permissions ?? null,
                dm_permission: c.dm_permission ?? null,
                default_member_permissions: c.default_member_permissions ?? null,
                testOnly: c.testOnly ?? null,
            }))
        }));

    const flatModules = tree.map(n => n.module);
    const flatCommands = tree.flatMap(n => n.commands);

    const target = path.join(PROJECT_ROOT, 'packages/common/src/manifest/bot-manifest.ts');
    const header = `// AUTO-GENERATED FILE. Do not edit manually.\n` +
        `// Run: pnpm exec tsx scripts/generate-bot-manifest.ts\n\n` +
        `export interface BotModuleDef { name: string; title: string; description: string; }\n` +
        `export interface BotCommand { name: string; description: string; module?: string | null; permissions?: string | null; dm_permission?: boolean | null; default_member_permissions?: string | null; testOnly?: boolean | null; }\n` +
        `export interface BotModuleNode { module: BotModuleDef; commands: ReadonlyArray<BotCommand>; }\n\n`;

    const modulesConst = `export const BOT_MODULES: ReadonlyArray<BotModuleDef> = ${JSON.stringify(flatModules, null, 4)} as const;\n\n`;
    const commandsConst = `export const BOT_COMMANDS: ReadonlyArray<BotCommand> = ${JSON.stringify(flatCommands, null, 4)} as const;\n\n`;
    const treeConst = `export const BOT_TREE: ReadonlyArray<BotModuleNode> = ${JSON.stringify(tree, null, 4)} as const;\n`;

    fs.writeFileSync(target, header + modulesConst + commandsConst + treeConst, 'utf8');
    console.log(`Wrote manifest with ${flatModules.length} modules and ${flatCommands.length} commands to ${target}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
