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
import { loadApplicationEmojiCache, syncApplicationEmojisFromDir } from './core/applicationEmojiManager.js';
import { tierEmojiNames } from './modules/league/constants/leagueTierEmojis.js';
import { getLogger, startMetricsSummaryLogger, incMetric } from '@zeffuro/fakegaming-common';
import { startHealthServer } from './utils/healthServer.js';

const {__dirname} = bootstrapEnv(import.meta.url);

const logger = getLogger({ name: 'bot' });

(async () => {
    try {
        // Start minimal periodic metrics summary logger
        startMetricsSummaryLogger({ service: 'bot', loggerName: 'bot:metrics' });

        deployCommands().then(() => {
            logger.info("Slash commands deployed.");
        }).catch(err => {
            logger.error({ err }, "Failed to deploy slash commands:");
        });

        const healthPortEnv = process.env.BOT_HEALTH_PORT ?? '';
        const parsedPort = Number.parseInt(healthPortEnv, 10);
        const healthPort = Number.isFinite(parsedPort) && parsedPort >= 0 ? parsedPort : 0;
        const healthHost = process.env.BOT_HEALTH_HOST ?? '127.0.0.1';
        // Fire-and-forget start of health server will happen after client is created

        if (!process.env.DISCORD_BOT_TOKEN) {
            logger.error('DISCORD_BOT_TOKEN is not set in environment variables.');
            process.exit(1);
        }
        await getConfigManager().init();

        // Load or sync application emojis (bot emoji store) from a hardcoded assets path
        try {
            const assetsDir = path.join(__dirname, '..', 'assets', 'application-emojis');
            await syncApplicationEmojisFromDir(assetsDir, Object.values(tierEmojiNames));
        } catch (e) {
            logger.warn({ err: e }, 'Application emoji initialization failed (non-fatal). Falling back to cache load.');
            try {
                await loadApplicationEmojiCache();
            } catch {
                // ignore
            }
        }

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
            logger.error({ err }, 'Error loading commands:');
            process.exit(1);
        }

        // Now that the client exists, bind it to the health server
        void startHealthServer({ client, port: healthPort, host: healthHost, logger });

        client.once('clientReady', async () => {
            logger.info({ user: client.user?.tag }, `Logged in as ${client.user?.tag}`);
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
                incMetric('command_exec', { name: interaction.commandName });
                try {
                    await command.execute(interaction);
                    incMetric('command_ok', { name: interaction.commandName });
                } catch (error) {
                    incMetric('command_error', { name: interaction.commandName });
                    logger.error({ err: error }, 'Error executing command');
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
                        logger.error({ err }, 'Failed to send error reply:');
                    }
                }
            }
        });

        await client.login(process.env.DISCORD_BOT_TOKEN);


    } catch (e) {
        logger.error('Uncaught fatal error at entrypoint.');
        logger.error({ type: typeof e, value: e }, 'Error envelope');
        if (e instanceof Error) {
            logger.error({ message: e.message, stack: e.stack }, 'Error details');
        } else {
            try {
                const full = JSON.stringify(e, null, 2);
                logger.error({ full }, 'Non-error throwable');
            } catch {
                // ignore JSON stringify errors
            }
            // Print a stack trace for the *catch location* (not the throw location)

            console.trace('Catch location stack trace');
        }
        process.exit(1);
    }
})();

export {FakegamingBot};