import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesPath = path.join(__dirname, '../src/modules');

async function findCommandDirs(modulesPath) {
    const moduleFolders = fs.readdirSync(modulesPath);
    const commandDirs = [];
    for (const folder of moduleFolders) {
        const commandsPath = path.join(modulesPath, folder, 'commands');
        if (fs.existsSync(commandsPath)) {
            commandDirs.push(commandsPath);
        }
    }
    return commandDirs;
}

async function loadCommands(commandDirs) {
    const commands = [];
    for (const dir of commandDirs) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        for (const file of files) {
            const cmdPath = path.join(dir, file);
            try {
                // Use dynamic import for ESM
                const commandModule = await import(pathToFileURL(cmdPath).href);
                const cmd = commandModule.default || commandModule;
                if (cmd && cmd.data && cmd.data.name && cmd.data.description) {
                    commands.push({
                        name: cmd.data.name,
                        description: cmd.data.description,
                        permissions: cmd.permissions || 'All users'
                    });
                }
            } catch (e) {
                // Ignore files that can't be imported
            }
        }
    }
    return commands;
}

function generateTable(commands) {
    let table = `| Command | Description | Permissions |\n|---------|-------------|-------------|\n`;
    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
        table += `|\`/${cmd.name}\`|${cmd.description}|${cmd.permissions}|\n`;
    }
    return table;
}

async function main() {
    const commandDirs = await findCommandDirs(modulesPath);
    const commands = await loadCommands(commandDirs);
    const table = generateTable(commands);

    const readmePath = path.join(__dirname, '../README.md');
    let readme = fs.readFileSync(readmePath, 'utf8');
    const start = '<!-- COMMAND_TABLE_START -->';
    const end = '<!-- COMMAND_TABLE_END -->';
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');

    const newSection = `${start}\n${table}${end}`;
    if (regex.test(readme)) {
        readme = readme.replace(regex, newSection);
    } else {
        readme += `\n\n${newSection}\n`;
    }

    fs.writeFileSync(readmePath, readme);
    console.log('README.md command table updated!');
}

main();