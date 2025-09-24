import './deploy-commands.js';

import {Client, Collection, Events, MessageFlags} from 'discord.js';
import path from 'path';
import {bootstrapEnv} from '@zeffuro/fakegaming-common/dist/core/bootstrapEnv.js';
import {configManager} from '@zeffuro/fakegaming-common/dist/managers/configManagerSingleton.js';
import {startBotServices} from './services/botScheduler.js';
import {loadCommands} from './core/loadCommands.js';
import {preloadAllModules} from './core/preloadModules.js';
import {deployCommands} from "./deploy-commands.js";

const {__dirname} = bootstrapEnv(import.meta.url);

(async () => {
    try {
        await deployCommands();

        if (!process.env.DISCORD_BOT_TOKEN) {
            console.error('DISCORD_BOT_TOKEN is not set in environment variables.');
            process.exit(1);
        }

        await configManager.init();

        await preloadAllModules();

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


    } catch (e) {
        console.error('Uncaught fatal error at entrypoint.');
        console.error('Type:', typeof e, 'Value:', e);
        if (e instanceof Error) {
            console.error('Error message:', e.message);
            console.error('Stack:', e.stack);
        } else {
            console.error('Full object:', JSON.stringify(e, null, 2));
            // Try to log stack if available
            if (typeof (e as any).stack === 'string') {
                console.error('Stack:', (e as any).stack);
            }
            // Print a stack trace for the *catch location* (not the throw location)
            console.trace('Catch location stack trace');
        }
        process.exit(1);
    }
})();