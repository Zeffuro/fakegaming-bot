import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getModulesPath, findModuleFolders, findCommandFiles, loadCommands, } from './lib/command-introspection.js';
// Compute project root based on this script location (repoRoot/scripts/..)
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function validateName(name) {
    if (name.length < 1 || name.length > 32)
        return `name length ${name.length} out of range [1,32]`;
    if (!/^[a-z0-9-]+$/.test(name))
        return 'name must match ^[a-z0-9-]+$ (lowercase, digits, hyphen)';
    return null;
}
function validateDescription(desc) {
    if (desc.length < 1 || desc.length > 100)
        return `description length ${desc.length} out of range [1,100]`;
    return null;
}
async function main() {
    const args = process.argv.slice(2);
    const strict = args.includes('--strict');
    const modulesPath = getModulesPath(PROJECT_ROOT);
    const moduleFolders = findModuleFolders(modulesPath);
    const perModule = [];
    for (const name of moduleFolders) {
        const modPath = path.join(modulesPath, name);
        const cmdDir = path.join(modulesPath, name, 'commands');
        const files = findCommandFiles(cmdDir);
        const manifestExists = [
            path.join(modPath, 'commands.manifest.ts'),
            path.join(modPath, 'commands.manifest.js'),
            path.join(modPath, 'commands.manifest.json'),
        ].some(p => fs.existsSync(p));
        // If the module has no commands and no manifest, skip strict fallback error
        if (!manifestExists && files.length === 0) {
            perModule.push({ name, commands: [], usedFallback: false, skipped: true });
            continue;
        }
        const res = await loadCommands(name, modPath, files, { allowFallback: !strict });
        perModule.push({ name, commands: res.commands, usedFallback: res.usedFallback, skipped: false });
    }
    const all = perModule.flatMap(m => m.commands);
    const errors = [];
    // Strict: any real module without a manifest should fail
    if (strict) {
        for (const m of perModule) {
            if (!m.skipped && m.usedFallback)
                errors.push(`Module '${m.name}' has no commands.manifest and fallback parsing is disallowed in --strict mode.`);
        }
    }
    // Uniqueness across all modules
    const byName = {};
    for (const c of all) {
        const key = c.name;
        byName[key] = byName[key] ?? [];
        byName[key].push(c);
    }
    for (const [name, items] of Object.entries(byName)) {
        if (items.length > 1) {
            const mods = items.map(i => i.module ?? 'unknown').join(', ');
            errors.push(`Duplicate command name '${name}' across modules: ${mods}`);
        }
    }
    // Constraint checks
    for (const c of all) {
        const nErr = validateName(c.name);
        if (nErr)
            errors.push(`Invalid name '${c.name}' in module '${c.module}': ${nErr}`);
        const dErr = validateDescription(c.description);
        if (dErr)
            errors.push(`Invalid description for '${c.name}' in module '${c.module}': ${dErr}`);
    }
    if (errors.length > 0) {
        console.error('Command manifest validation failed:');
        for (const e of errors)
            console.error(' - ' + e);
        process.exit(1);
        return;
    }
    const manifestCount = perModule.filter(m => !m.skipped && !m.usedFallback).length;
    const realModules = perModule.filter(m => !m.skipped).length;
    console.log(`Validated ${all.length} commands across ${moduleFolders.length} modules. Manifests: ${manifestCount}/${realModules}. No issues found.${strict ? ' (strict)' : ''}`);
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
