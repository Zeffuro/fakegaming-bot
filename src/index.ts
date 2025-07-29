import './deploy-commands.js';

import {Client, Collection, Events, MessageFlags} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {configManager} from './config/configManagerSingleton.js';
import {subscribeAllStreams} from "./services/twitchService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {recursive: true});
}

await configManager.init();
dotenv.config();

// Extend Client to add commands property
class FakegamingBot extends Client {
    commands: Collection<string, any>;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

const client = new FakegamingBot({intents: [1 << 0]}); // Guilds intent

const modulesPath = path.join(__dirname, 'modules');
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
            });
        }
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    await subscribeAllStreams(client); // Initial check

    // Poll every 60 seconds
    setInterval(() => {
        subscribeAllStreams(client);
    }, 60_000);
});

client.on(Events.InteractionCreate, async (interaction: import('discord.js').Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({content: 'Error executing command.', flags: MessageFlags.Ephemeral});
    }
});

await client.login(process.env.DISCORD_BOT_TOKEN);