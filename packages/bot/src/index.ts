debugger;
import './deploy-commands.js';

import {
    Events, GatewayIntentBits,
    MessageFlags
} from 'discord.js';
import path from 'path';
import {FakegamingBot} from './core/FakegamingBot.js';
import {bootstrapEnv} from '@zeffuro/fakegaming-common/core';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {startBotServices} from './services/botScheduler.js';
import {loadCommands} from './core/loadCommands.js';
import {preloadAllModules} from './core/preloadModules.js';
import {deployCommands} from "./deploy-commands.js";

const {__dirname} = bootstrapEnv(import.meta.url);


(async () => {
    try {
        deployCommands().then(() => {
            console.log("Slash commands deployed.");
        }).catch(err => {
            console.error("Failed to deploy slash commands:", err);
        });

        if (!process.env.DISCORD_BOT_TOKEN) {
            console.error('DISCORD_BOT_TOKEN is not set in environment variables.');
            process.exit(1);
        }
        await getConfigManager().init();

        await preloadAllModules();

        const client = new FakegamingBot({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

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
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: 'Error executing command.',
                                flags: MessageFlags.Ephemeral
                            });
                        } else {
                            await interaction.editReply({content: 'Error executing command.'});
                        }
                    } catch (err) {
                        console.error('Failed to send error reply:', err);
                    }
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
            if (typeof e === 'object' && e !== null) {
                if ('message' in e) {
                    console.error('Error message:', (e as { message: string }).message);
                }
                if ('stack' in e) {
                    console.error('Stack:', (e as { stack: string }).stack);
                }
            }
            // Print a stack trace for the *catch location* (not the throw location)
            console.trace('Catch location stack trace');
        }
        process.exit(1);
    }
})();

export {FakegamingBot};