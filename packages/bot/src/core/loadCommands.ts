import fs from 'fs';
import {pathToFileURL} from 'url';
import path from 'path';
import type {FakegamingBot} from '../index.js';
import { findCommandFiles } from './commandsFs.js';

/**
 * Loads all command modules from the specified modulesPath and registers them with the Discord client.
 * Only modules with both data and execute are registered.
 */
export async function loadCommands(client: FakegamingBot, modulesPath: string) {
    if (!fs.existsSync(modulesPath)) return;
    const commandFiles = findCommandFiles(modulesPath);
    const commandSources = new Map<string, string>();
    for (const commandPath of commandFiles) {
        const commandModule = await import(pathToFileURL(commandPath).href);
        const cmd = commandModule.default;
        if (cmd?.data && cmd?.execute) {
            const commandName = cmd.data.name;
            const previousCommandPath = commandSources.get(commandName);
            if (previousCommandPath !== undefined) {
                throw new Error(
                    `Duplicate command name "${commandName}" found in "${previousCommandPath}" and "${commandPath}"`,
                );
            }
            commandSources.set(commandName, commandPath);
            // Derive module name from file path: modules/{module}/commands/*.{ts,js}
            const commandsDir = path.dirname(commandPath);
            const moduleDir = path.dirname(commandsDir);
            const moduleName = path.basename(moduleDir);
            const description = typeof cmd.description === 'string'
                ? cmd.description
                : typeof cmd.data.description === 'string'
                    ? cmd.data.description
                    : undefined;
            client.commands.set(commandName, {
                data: cmd.data,
                description,
                execute: cmd.execute,
                autocomplete: cmd.autocomplete,
                handleComponent: cmd.handleComponent,
                moduleName,
            });
        }
    }
}
