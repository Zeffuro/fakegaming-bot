import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesPath = path.join(__dirname, '../src/modules');

if (!fs.existsSync(modulesPath)) {
    console.error(`ERROR: modules directory not found at ${modulesPath}`);
    process.exit(1);
}

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
    if (commands.length === 0) {
        console.warn('WARNING: No commands found. The command table will be empty.');
    } else {
        console.log(`Found ${commands.length} commands in ${commandDirs.length} directories.`);
    }
    const table = generateTable(commands);

    const readmePath = path.join(__dirname, '../README.md');
    let readme;
    try {
        readme = fs.readFileSync(readmePath, 'utf8');
    } catch (err) {
        console.error(`ERROR: Could not read README at ${readmePath}:`, err);
        process.exit(1);
    }
    const start = '<!-- COMMAND_TABLE_START -->';
    const end = '<!-- COMMAND_TABLE_END -->';
    const regex = new RegExp(`${start}[\\s\\S]*?${end}`, 'm');
    const newSection = `${start}\n${table}${end}`;
    let updated = false;
    if (regex.test(readme)) {
        if (readme.match(regex)[0] !== newSection) {
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