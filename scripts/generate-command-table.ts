import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve project root based on this script location (repoRoot/scripts/..)
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = path.join(PROJECT_ROOT, 'README.md');
const COMMAND_DOCS_PATH = path.join(PROJECT_ROOT, 'docs/generated/commands.md');

type BotCommandType = 'chatInput' | 'user' | 'message';

interface BotCommand {
    name: string;
    description: string;
    module?: string | null;
    permissions?: string | null;
    type?: BotCommandType | null;
}

interface BotModuleDef {
    name: string;
    title: string;
    description: string;
}

interface BotModuleNode {
    module: BotModuleDef;
    commands: ReadonlyArray<BotCommand>;
}

interface CommandCounts {
    total: number;
    chatInput: number;
    user: number;
    message: number;
}

function getCommandType(command: BotCommand): BotCommandType {
    return command.type ?? 'chatInput';
}

function getCommandLabel(command: BotCommand): string {
    return getCommandType(command) === 'chatInput' ? `/${command.name}` : command.name;
}

function getCommandTypeLabel(command: BotCommand): string {
    const type = getCommandType(command);
    if (type === 'user') return 'User context';
    if (type === 'message') return 'Message context';
    return 'Slash';
}

function escapeCell(value: string): string {
    return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function countCommands(commands: ReadonlyArray<BotCommand>): CommandCounts {
    const counts: CommandCounts = {
        total: commands.length,
        chatInput: 0,
        user: 0,
        message: 0,
    };

    for (const command of commands) {
        counts[getCommandType(command)] += 1;
    }

    return counts;
}

function generateReadmeTable(commands: ReadonlyArray<BotCommand>): string {
    let table = `| Command | Type | Description | Permissions |\n|---------|------|-------------|-------------|\n`;
    const sorted = [...commands].sort((a, b) => getCommandLabel(a).localeCompare(getCommandLabel(b)));
    for (const cmd of sorted) {
        const perms = cmd.permissions ?? 'All users';
        table += `|\`${escapeCell(getCommandLabel(cmd))}\`|${escapeCell(getCommandTypeLabel(cmd))}|${escapeCell(cmd.description)}|${escapeCell(perms)}|\n`;
    }
    return table;
}

function generateCommandDocs(tree: ReadonlyArray<BotModuleNode>, commands: ReadonlyArray<BotCommand>): string {
    const counts = countCommands(commands);
    const lines = [
        '# Bot Commands',
        '',
        'Generated from `packages/common/src/manifest/bot-manifest.ts`. Do not edit by hand.',
        '',
        `Total: ${counts.total} commands; ${counts.chatInput} slash; ${counts.user} user context; ${counts.message} message context.`,
        '',
    ];

    for (const node of tree) {
        if (node.commands.length === 0) {
            continue;
        }

        lines.push(`## ${node.module.title}`, '');
        lines.push('| Type | Command | Description | Permissions |');
        lines.push('| --- | --- | --- | --- |');

        const sorted = [...node.commands].sort((a, b) => getCommandLabel(a).localeCompare(getCommandLabel(b)));
        for (const command of sorted) {
            const permissions = command.permissions ?? 'All users';
            lines.push(`| ${escapeCell(getCommandTypeLabel(command))} | \`${escapeCell(getCommandLabel(command))}\` | ${escapeCell(command.description)} | ${escapeCell(permissions)} |`);
        }

        lines.push('');
    }

    return lines.join('\n');
}

function writeOrCheckFile(filePath: string, content: string, checkMode: boolean, staleMessage: string, updatedMessage: string, currentMessage: string): boolean {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;

    if (existing === content) {
        console.log(currentMessage);
        return false;
    }

    if (checkMode) {
        console.error(staleMessage);
        process.exitCode = 1;
        return true;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(updatedMessage);
    return true;
}

async function main(): Promise<void> {
    const checkMode = process.argv.includes('--check');

    // Load the generated manifest directly to avoid importing bot code
    const manifestPath = path.join(PROJECT_ROOT, 'packages/common/src/manifest/bot-manifest.ts');
    if (!fs.existsSync(manifestPath)) {
        console.error(`ERROR: Manifest not found at ${manifestPath}. Run: pnpm run gen:manifest`);
        process.exit(1);
        return;
    }

    type ManifestMod = { BOT_COMMANDS?: ReadonlyArray<BotCommand>; BOT_TREE?: ReadonlyArray<BotModuleNode> };
    const mod = (await import(pathToFileURL(manifestPath).href)) as ManifestMod;
    const commands = Array.isArray(mod.BOT_COMMANDS) ? mod.BOT_COMMANDS : [];
    const tree = Array.isArray(mod.BOT_TREE) ? mod.BOT_TREE : [];

    if (commands.length === 0) {
        console.warn('WARNING: No commands in manifest. The command table will be empty.');
    } else {
        console.log(`Using ${commands.length} commands from manifest.`);
    }

    const table = generateReadmeTable(commands);

    // README is at project root
    let readme: string;
    try {
        readme = fs.readFileSync(README_PATH, 'utf8');
    } catch (err) {
        console.error(`ERROR: Could not read README at ${README_PATH}:`, err);
        process.exit(1);
        return;
    }

    const start = '<!-- COMMAND_TABLE_START -->';
    const end = '<!-- COMMAND_TABLE_END -->';
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
    const newSection = `${start}\n\nFull generated catalog: [docs/generated/commands.md](./docs/generated/commands.md).\n\n${table}${end}`;

    let nextReadme = readme;
    const match = readme.match(regex);
    if (match) {
        if (match[0] !== newSection) {
            nextReadme = readme.replace(regex, newSection);
        }
    } else if (!readme.includes(newSection)) {
        nextReadme = `${readme.trimEnd()}\n\n${newSection}\n`;
    }

    const updated = nextReadme !== readme;

    if (updated) {
        if (checkMode) {
            console.error('README.md command table is out of date. Run: pnpm run gen:command-table');
            process.exitCode = 1;
        } else {
            fs.writeFileSync(README_PATH, nextReadme, 'utf8');
            console.log('README.md command table updated!');
        }
    } else {
        console.log('README.md command table is already up-to-date.');
    }

    const commandDocs = generateCommandDocs(tree, commands);
    writeOrCheckFile(
        COMMAND_DOCS_PATH,
        commandDocs,
        checkMode,
        'Generated command docs are out of date. Run: pnpm run gen:command-table',
        `Wrote generated command docs to ${COMMAND_DOCS_PATH}`,
        'Generated command docs are already up-to-date.',
    );

    if (process.exitCode && process.exitCode !== 0) {
        process.exit(process.exitCode);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
