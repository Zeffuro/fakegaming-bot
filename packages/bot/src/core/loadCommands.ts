import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import type {FakegamingBot} from '../index.js';

/**
 * Loads all command modules from the specified modulesPath and registers them with the Discord client.
 * Only modules with both data and execute are registered.
 */
export async function loadCommands(client: FakegamingBot, modulesPath: string) {
    const moduleFolders = fs.readdirSync(modulesPath);
    for (const folder of moduleFolders) {
        const commandsPath = path.join(modulesPath, folder, 'commands');
        if (!fs.existsSync(commandsPath)) continue;
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            const commandModule = await import(pathToFileURL(commandPath).href);
            const cmd = commandModule.default;
            if (cmd?.data && cmd?.execute) {
                client.commands.set(cmd.data.name, {
                    data: cmd.data,
                    execute: cmd.execute,
                    autocomplete: cmd.autocomplete,
                });
            }
        }
    }
}