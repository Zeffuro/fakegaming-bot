import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Resolve project root based on this script location (repoRoot/scripts/..)
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function generateTable(commands) {
    let table = `| Command | Description | Permissions |\n|---------|-------------|-------------|\n`;
    const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name));
    for (const cmd of sorted) {
        const perms = cmd.permissions ?? 'All users';
        table += `|\`/${cmd.name}\`|${cmd.description}|${perms}|\n`;
    }
    return table;
}
async function main() {
    // Load the generated manifest directly to avoid importing bot code
    const manifestPath = path.join(PROJECT_ROOT, 'packages/common/src/manifest/bot-manifest.ts');
    if (!fs.existsSync(manifestPath)) {
        console.error(`ERROR: Manifest not found at ${manifestPath}. Run: pnpm run gen:manifest`);
        process.exit(1);
        return;
    }
    const mod = (await import(pathToFileURL(manifestPath).href));
    const commands = Array.isArray(mod.BOT_COMMANDS) ? mod.BOT_COMMANDS : [];
    if (commands.length === 0) {
        console.warn('WARNING: No commands in manifest. The command table will be empty.');
    }
    else {
        console.log(`Using ${commands.length} commands from manifest.`);
    }
    const table = generateTable(commands);
    // README is at project root
    const readmePath = path.join(PROJECT_ROOT, 'README.md');
    let readme;
    try {
        readme = fs.readFileSync(readmePath, 'utf8');
    }
    catch (err) {
        console.error(`ERROR: Could not read README at ${readmePath}:`, err);
        process.exit(1);
        return;
    }
    const start = '<!-- COMMAND_TABLE_START -->';
    const end = '<!-- COMMAND_TABLE_END -->';
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
    const newSection = `${start}\n\n${table}${end}`;
    let updated = false;
    const match = readme.match(regex);
    if (match) {
        if (match[0] !== newSection) {
            readme = readme.replace(regex, newSection);
            updated = true;
        }
    }
    else if (!readme.endsWith(newSection)) {
        readme += `\n\n${newSection}\n`;
        updated = true;
    }
    if (updated) {
        fs.writeFileSync(readmePath, readme, 'utf8');
        console.log('README.md command table updated!');
    }
    else {
        console.log('README.md command table is already up-to-date.');
    }
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
