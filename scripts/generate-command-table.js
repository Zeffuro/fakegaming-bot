const fs = require('fs');
const path = require('path');

const modulesPath = path.join(__dirname, '../modules');

function findCommandDirs(modulesPath) {
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

function loadCommands(commandDirs) {
    const commands = [];
    for (const dir of commandDirs) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        for (const file of files) {
            const cmdPath = path.join(dir, file);
            try {
                const cmd = require(cmdPath).default || require(cmdPath);
                if (cmd && cmd.data && cmd.data.name && cmd.data.description) {
                    commands.push({
                        name: cmd.data.name,
                        description: cmd.data.description,
                        permissions: cmd.permissions || 'All users'
                    });
                }
            } catch {
                // Ignore files that can't be required (e.g. not a command)
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

const commandDirs = findCommandDirs(modulesPath);
const commands = loadCommands(commandDirs);
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