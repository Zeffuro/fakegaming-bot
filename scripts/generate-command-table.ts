import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { PROJECT_ROOT } from '@zeffuro/fakegaming-common/core';

// Adjust this to either 'src' for TS or 'dist' for compiled JS
const modulesPath = path.join(PROJECT_ROOT, 'packages/bot/src/modules');

function findCommandDirs(modulesPath: string): string[] {
    if (!fs.existsSync(modulesPath)) {
        console.error(`ERROR: modules directory not found at ${modulesPath}`);
        process.exit(1);
    }

    const moduleFolders = fs.readdirSync(modulesPath, { withFileTypes: true })
        .filter(f => f.isDirectory())
        .map(f => f.name);

    const commandDirs: string[] = [];
    for (const folder of moduleFolders) {
        const commandsPath = path.join(modulesPath, folder, 'commands');
        if (fs.existsSync(commandsPath)) {
            console.log(`Found commands folder: ${commandsPath}`);
            commandDirs.push(commandsPath);
        } else {
            console.log(`No commands folder in: ${folder}`);
        }
    }

    return commandDirs;
}

async function loadCommands(commandDirs: string[]) {
    const commands: { name: string, description: string, permissions: string }[] = [];

    for (const dir of commandDirs) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        if (files.length === 0) {
            console.log(`No command files in: ${dir}`);
            continue;
        }

        for (const file of files) {
            const cmdPath = path.join(dir, file);
            try {
                const commandModule = await import(pathToFileURL(cmdPath).href);
                const cmd = commandModule.default || commandModule;

                if (cmd && cmd.data && cmd.data.name && cmd.data.description) {
                    commands.push({
                        name: cmd.data.name,
                        description: cmd.data.description,
                        permissions: cmd.permissions || 'All users'
                    });
                    console.log(`Loaded command: ${cmd.data.name} from ${cmdPath}`);
                } else {
                    console.warn(`Skipping ${cmdPath}: missing data.name or data.description`);
                }
            } catch (e) {
                console.error(`Failed to import ${cmdPath}:`, e);
            }
        }
    }

    return commands;
}

function generateTable(commands: { name: string, description: string, permissions: string }[]) {
    let table = `| Command | Description | Permissions |\n|---------|-------------|-------------|\n`;
    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
        table += `|\`/${cmd.name}\`|${cmd.description}|${cmd.permissions}|\n`;
    }
    return table;
}

async function main() {
    console.log(`Scanning modulesPath: ${modulesPath}`);
    const commandDirs = findCommandDirs(modulesPath);
    const commands = await loadCommands(commandDirs);

    if (commands.length === 0) {
        console.warn('WARNING: No commands found. The command table will be empty.');
    } else {
        console.log(`Found ${commands.length} commands in ${commandDirs.length} directories.`);
    }

    const table = generateTable(commands);

    // README is at project root
    const readmePath = path.join(PROJECT_ROOT, 'README.md');
    let readme: string;
    try {
        readme = fs.readFileSync(readmePath, 'utf8');
    } catch (err) {
        console.error(`ERROR: Could not read README at ${readmePath}:`, err);
        process.exit(1);
    }

    const start = '<!-- COMMAND_TABLE_START -->';
    const end = '<!-- COMMAND_TABLE_END -->';
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
    const newSection = `${start}\n\n${table}${end}`;

    let updated = false;
    if (regex.test(readme)) {
        if (readme.match(regex)![0] !== newSection) {
            readme = readme.replace(regex, newSection);
            updated = true;
        }
    } else if (!readme.endsWith(newSection)) {
        readme += `\n\n${newSection}\n`;
        updated = true;
    }

    if (updated) {
        fs.writeFileSync(readmePath, readme);
        console.log('README.md command table updated!');
    } else {
        console.log('README.md command table is already up-to-date.');
    }
}

main();
