import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

export async function loadCommands(client: any, modulesPath: string) {
    const moduleFolders = fs.readdirSync(modulesPath);
    for (const folder of moduleFolders) {
        const commandsPath = path.join(modulesPath, folder, 'commands');
        if (!fs.existsSync(commandsPath)) continue;
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            const commandModule = await import(pathToFileURL(commandPath).href);
            if (commandModule.data && commandModule.execute) {
                client.commands.set(commandModule.data.name, {
                    data: commandModule.data,
                    execute: commandModule.execute,
                    autocomplete: commandModule.autocomplete,
                });
            }
        }
    }
}