import fs from 'fs';
import {pathToFileURL} from 'url';
import type {FakegamingBot} from '../index.js';
import { findCommandFiles } from './commandsFs.js';

/**
 * Loads all command modules from the specified modulesPath and registers them with the Discord client.
 * Only modules with both data and execute are registered.
 */
export async function loadCommands(client: FakegamingBot, modulesPath: string) {
    if (!fs.existsSync(modulesPath)) return;
    const commandFiles = findCommandFiles(modulesPath);
    for (const commandPath of commandFiles) {
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