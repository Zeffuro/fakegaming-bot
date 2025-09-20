import './deploy-commands.js';

import {Client, Collection, Events, MessageFlags} from 'discord.js';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {bootstrapEnv} from './core/bootstrapEnv.js';
import {configManager} from './config/configManagerSingleton.js';
import {startBotServices} from './services/botScheduler.js';
import {loadCommands} from './core/loadCommands.js';

const {__dirname} = bootstrapEnv(import.meta.url);

if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN is not set in environment variables.');
    process.exit(1);
}

const dataDir = process.env.DATA_ROOT || path.join(__dirname, '..', 'data');

await configManager.init();

class FakegamingBot extends Client {
    commands: Collection<string, any>;

    constructor(options: any) {
        super(options);
        this.commands = new Collection();
    }
}

const client = new FakegamingBot({intents: [1 << 0]}); // Guilds intent

const modulesPath = path.join(__dirname, 'modules');

try {
    await loadCommands(client, modulesPath);
} catch (err) {
    console.error('Error loading commands:', err);
    process.exit(1);
}

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    startBotServices(client);
});

client.on(Events.InteractionCreate, async (interaction: import('discord.js').Interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    if (interaction.isAutocomplete() && command.autocomplete) {
        await command.autocomplete(interaction);
        return;
    }
    if (interaction.isChatInputCommand()) {
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({content: 'Error executing command.', flags: MessageFlags.Ephemeral});
        }
    }
});

await client.login(process.env.DISCORD_BOT_TOKEN);