/**
 * check-env-leaks.ts
 *
 * Fails (exit code 1) if any .env* files (except .env.example) are tracked by git.
 * Emits non-fatal warnings for quoted values in any local .env files it can find.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function isEnvFile(name: string): boolean {
    if (!name) return false;
    if (name.endsWith('.env.example')) return false;
    const base = path.basename(name);
    if (base === '.env') return true;
    if (base.startsWith('.env.')) return true;
    return /^\.env(\..+)?$/i.test(base);
}

function listLocalEnvFiles(): string[] {
    const roots = [process.cwd(), path.join(process.cwd(), 'packages')];
    const results: string[] = [];

    for (const root of roots) {
        if (!existsSync(root)) continue;
        const walk = (dir: string) => {
            let entries: string[];
            try {
                entries = readdirSync(dir);
            } catch {
                return;
            }
            for (const entry of entries) {
                const p = path.join(dir, entry);
                try {
                    const st = statSync(p);
                    if (st.isDirectory()) {
                        // Skip node_modules and .git for speed
                        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
                        walk(p);
                    } else if (st.isFile() && isEnvFile(entry)) {
                        results.push(p);
                    }
                } catch {
                    // ignore permission or transient errors
                }
            }
        };
        walk(root);
    }

    // De-duplicate
    return Array.from(new Set(results));
}

function checkQuotedValues(filePath: string): string[] {
    try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const warnings: string[] = [];
        const kvRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.trimStart().startsWith('#')) continue;
            const m = kvRegex.exec(line);
            if (!m) continue;
            const value = m[2]?.trim();
            if (!value) continue;
            // Warn if wrapped in single or double quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                warnings.push(`Line ${i + 1}: ${m[1]} is quoted; prefer unquoted values in dotenv files.`);
            }
        }
        return warnings;
    } catch {
        return [];
    }
}

function main() {
    let exitCode = 0;

    // 1) Fail if any .env files are tracked
    if (existsSync(path.join(process.cwd(), '.git'))) {
        const git = spawnSync('git', ['--no-pager', 'ls-files'], { encoding: 'utf8' });
        if (git.status === 0) {
            const tracked = (git.stdout as string).split(/\r?\n/).filter(Boolean);
            const leaked = tracked.filter((f) => isEnvFile(f));
            // Allow .env.example
            const leakedFiltered = leaked.filter((f) => !f.endsWith('.env.example'));
            if (leakedFiltered.length > 0) {
                console.error('ERROR: The following .env files are tracked by git (should be ignored):');
                for (const f of leakedFiltered) {
                    console.error(` - ${f}`);
                }
                console.error('Action: Remove these from git history (git rm --cached), ensure they are in .gitignore, and rotate any leaked secrets.');
                exitCode = 1;
            }
        } else {
            console.warn('WARN: Unable to query git tracked files; skipping tracked .env check.');
        }
    }

    // 2) Warn about quoted values in local .env files
    const envFiles = listLocalEnvFiles();
    for (const f of envFiles) {
        const warnings = checkQuotedValues(f);
        if (warnings.length > 0) {
            console.warn(`WARN: Quoted values detected in ${path.relative(process.cwd(), f)}:`);
            for (const w of warnings) {
                console.warn(`  - ${w}`);
            }
        }
    }

    process.exitCode = exitCode;
}

main();
