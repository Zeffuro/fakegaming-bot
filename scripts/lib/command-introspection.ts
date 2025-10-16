import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface CommandOut { name: string; description: string; module?: string | null; permissions?: string | null; hidden?: boolean | null; dm_permission?: boolean | null; default_member_permissions?: string | null; testOnly?: boolean | null; }
export interface ModuleOut { name: string; title: string; description: string; hidden?: boolean | null; sortOrder?: number | null; }
export interface ModuleMeta { title?: string; description?: string; hidden?: boolean; sortOrder?: number; }
export interface LoadResult { commands: CommandOut[]; usedFallback: boolean; }

export function getModulesPath(projectRoot: string): string {
    return fs.existsSync(path.join(projectRoot, 'packages/bot/src/modules'))
        ? path.join(projectRoot, 'packages/bot/src/modules')
        : path.join(projectRoot, 'packages/bot/dist/modules');
}

export function titleize(name: string): string {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function findModuleFolders(root: string): string[] {
    if (!fs.existsSync(root)) throw new Error(`modules directory not found at ${root}`);
    return fs.readdirSync(root, { withFileTypes: true }).filter(f => f.isDirectory()).map(f => f.name);
}

export function loadModuleMeta(modPath: string): ModuleMeta | null {
    const candidates = ['module.meta.json', 'module.json'];
    for (const file of candidates) {
        const full = path.join(modPath, file);
        if (fs.existsSync(full)) {
            try {
                const raw = fs.readFileSync(full, 'utf8');
                return JSON.parse(raw) as ModuleMeta;
            } catch {
                return null;
            }
        }
    }
    return null;
}

export function findCommandFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts')).map(f => path.join(dir, f));
}

export function extractString(regex: RegExp, text: string): string | null {
    const m = regex.exec(text);
    if (!m) return null;
    if (m.length >= 3 && typeof m[2] === 'string') return m[2];
    if (m.length >= 2 && typeof m[1] === 'string') return m[1];
    return null;
}

export async function loadCommandsFromManifest(moduleDir: string): Promise<CommandOut[] | null> {
    const jsonPath = path.join(moduleDir, 'commands.manifest.json');
    const tsPath = path.join(moduleDir, 'commands.manifest.ts');
    const jsPath = path.join(moduleDir, 'commands.manifest.js');

    try {
        if (fs.existsSync(jsonPath)) {
            const raw = fs.readFileSync(jsonPath, 'utf8');
            const arr = JSON.parse(raw) as Array<Partial<CommandOut>>;
            return arr.filter(Boolean).map((c) => ({
                name: String(c.name ?? ''),
                description: String(c.description ?? ''),
                permissions: (c.permissions ?? null) as string | null,
                hidden: (typeof c.hidden === 'boolean' ? c.hidden : null) as boolean | null,
                dm_permission: (typeof c.dm_permission === 'boolean' ? c.dm_permission : null) as boolean | null,
                default_member_permissions: c.default_member_permissions == null ? null : String(c.default_member_permissions),
                testOnly: (typeof c.testOnly === 'boolean' ? c.testOnly : null) as boolean | null,
                module: null,
            })).filter(c => c.name && c.description);
        }
        const loadPath = fs.existsSync(tsPath) ? tsPath : (fs.existsSync(jsPath) ? jsPath : null);
        if (loadPath) {
            const mod = await import(pathToFileURL(loadPath).href);
            const raw = (mod.COMMANDS ?? (Array.isArray(mod) ? mod : null)) as Array<any> | null;
            if (Array.isArray(raw)) {
                return raw.map((c) => ({
                    name: String(c.name ?? ''),
                    description: String(c.description ?? ''),
                    permissions: (c.permissions ?? null) as string | null,
                    hidden: (typeof c.hidden === 'boolean' ? c.hidden : null) as boolean | null,
                    dm_permission: (typeof c.dm_permission === 'boolean' ? c.dm_permission : null) as boolean | null,
                    default_member_permissions: c.default_member_permissions == null ? null : String(c.default_member_permissions),
                    testOnly: (typeof c.testOnly === 'boolean' ? c.testOnly : null) as boolean | null,
                    module: null,
                })).filter(c => c.name && c.description);
            }
        }
    } catch {
        // ignore manifest load errors
    }
    return null;
}

export function parseConfigValues(moduleDir: string, commandSource: string): { name: string | null; description: string | null } {
    const importMatch = /import\s*{\s*([A-Za-z0-9_]+)\s*}\s*from\s*["']\.\.\/config\.(?:js|ts)["']/.exec(commandSource);
    if (!importMatch) return { name: null, description: null };
    const cfgIdent = importMatch[1];

    const configPathTs = path.join(moduleDir, 'config.ts');
    const configPathJs = path.join(moduleDir, 'config.js');
    const configPath = fs.existsSync(configPathTs) ? configPathTs : (fs.existsSync(configPathJs) ? configPathJs : null);
    if (!configPath) return { name: null, description: null };

    const cfgSource = fs.readFileSync(configPath, 'utf8');

    const nameVal = extractString(new RegExp(`export\\s+const\\s+${cfgIdent}\\s*=\\s*{[\\s\\S]*?commandName\\s*:\\s*(["'])([\\s\\S]*?)\\1`), cfgSource);
    const descVal = extractString(new RegExp(`export\\s+const\\s+${cfgIdent}\\s*=\\s*{[\\s\\S]*?description\\s*:\\s*(["'])([\\s\\S]*?)\\1`), cfgSource);

    const safeName = nameVal && !nameVal.includes('${') ? nameVal : null;
    const safeDesc = descVal && !descVal.includes('${') ? descVal : null;
    return { name: safeName, description: safeDesc };
}

export function parseCommandFile(moduleDir: string, source: string): { name: string | null; description: string | null; hidden: boolean; permissions: string | null } {
    const name = extractString(/\.setName\(\s*(["'])([\s\S]*?)\1\s*\)/, source);
    const description = extractString(/\.setDescription\(\s*(["'])([\s\S]*?)\1\s*\)/, source);

    let finalName = name && !name.includes('${') ? name : null;
    let finalDesc = description && !description.includes('${') ? description : null;

    if (!finalName || !finalDesc) {
        const cfg = parseConfigValues(moduleDir, source);
        finalName = finalName ?? cfg.name;
        finalDesc = finalDesc ?? cfg.description;
    }

    const hidden = /\bhidden\s*:\s*true\b/.test(source);
    const permissions = extractString(/\bpermissions\s*:\s*(["'])([\s\S]*?)\1/, source);

    return { name: finalName, description: finalDesc, hidden, permissions: permissions ?? null };
}

export async function loadCommands(moduleName: string, moduleDir: string, files: string[], options?: { allowFallback?: boolean }): Promise<LoadResult> {
    const allowFallback = options?.allowFallback !== false;
    const fromManifest = await loadCommandsFromManifest(moduleDir);
    if (fromManifest && fromManifest.length > 0) {
        return { commands: fromManifest.map(c => ({ ...c, module: moduleName })), usedFallback: false };
    }

    if (!allowFallback) {
        // No manifest and fallback disabled
        return { commands: [], usedFallback: true };
    }

    const out: CommandOut[] = [];
    for (const file of files) {
        try {
            const source = fs.readFileSync(file, 'utf8');
            const parsed = parseCommandFile(moduleDir, source);
            if (parsed.name && parsed.description) {
                out.push({
                    name: parsed.name,
                    description: parsed.description,
                    module: moduleName,
                    permissions: parsed.permissions ?? null,
                    hidden: parsed.hidden ? true : null,
                    dm_permission: null,
                    default_member_permissions: null,
                    testOnly: null,
                });
            }
        } catch {
            // ignore parse errors
        }
    }
    return { commands: out, usedFallback: true };
}

export async function listImplementationCommands(moduleDir: string): Promise<string[]> {
    const cmdDir = path.join(moduleDir, 'commands');
    const files = findCommandFiles(cmdDir);
    const names: string[] = [];
    for (const file of files) {
        try {
            const mod = await import(pathToFileURL(file).href);
            const exp = (mod as any)?.default ?? mod;
            const name: unknown = exp?.data?.name;
            if (typeof name === 'string' && name.length > 0) names.push(name);
        } catch {
            // ignore
        }
    }
    return names;
}
