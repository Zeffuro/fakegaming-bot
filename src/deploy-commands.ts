import {REST} from 'discord.js';
import {Routes} from 'discord-api-types/rest/v10';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {bootstrapEnv} from './core/bootstrapEnv.js';

const {__dirname} = bootstrapEnv(import.meta.url);

const testCommands: object[] = [];
const globalCommands: object[] = [];
const modulesPath = path.join(__dirname, 'modules');
const moduleFolders = fs.readdirSync(modulesPath);

for (const folder of moduleFolders) {
    const commandsPath = path.join(modulesPath, folder, 'commands');
    if (!fs.existsSync(commandsPath)) continue;
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));
    for (const file of commandFiles) {
        const commandPath = path.join(commandsPath, file);
        const commandModule = await import(pathToFileURL(commandPath).href);
        const cmd = commandModule.default;
        if (cmd?.data) {
            if (cmd.testOnly) {
                testCommands.push(cmd.data.toJSON());
            } else {
                globalCommands.push(cmd.data.toJSON());
            }
        }
    }
}

const rest = new REST({version: '10'}).setToken(process.env.DISCORD_BOT_TOKEN!);

async function commandsAreDifferent(existing: object[], local: object[]) {
    return JSON.stringify(existing) !== JSON.stringify(local);
}

(async () => {
    try {
        // Global commands
        const existingGlobal = await rest.get(
            Routes.applicationCommands(process.env.CLIENT_ID!)
        ) as object[];
        if (await commandsAreDifferent(existingGlobal.map(cmd => cmd), globalCommands)) {
            const updatedGlobal = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID!),
                {body: globalCommands},
            );
            console.log('Accepted global commands:', updatedGlobal);
        } else {
            console.log('Global commands are up to date.');
        }

        // Guild commands
        if (process.env.GUILD_ID) {
            const existingGuild = await rest.get(
                Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID)
            ) as object[];
            if (await commandsAreDifferent(existingGuild.map(cmd => cmd), testCommands)) {
                const updatedTest = await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID),
                    {body: testCommands},
                );
                console.log('Updated test (guild) commands.', updatedTest);
            } else {
                console.log('Test (guild) commands are up to date.');
            }
        }
    } catch (error) {
        console.error(error);
    }
})();