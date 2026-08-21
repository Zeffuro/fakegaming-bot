import { runtimeText } from './core/runtimeCopy.js';
import './earlyEnv.js';

import {
    Events, GatewayIntentBits,
    MessageFlags,
    type Interaction,
} from 'discord.js';
import path from 'path';
import {FakegamingBot, type ExecutableCommandInteraction} from './core/FakegamingBot.js';
import {bootstrapEnv} from '@zeffuro/fakegaming-common/core';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {loadCommands} from './core/loadCommands.js';
import {preloadAllModules} from './core/preloadModules.js';
import {deployCommands} from "./deploy-commands.js";
import {ComponentRouter, componentNamespace} from './core/componentRouter.js';
import {deployCommandsAtStartup} from './core/startupDeployment.js';
import { loadApplicationEmojiCache, syncApplicationEmojisFromDir } from './core/applicationEmojiManager.js';
import { tierEmojiNames } from './modules/league/constants/leagueTierEmojis.js';
import { getLogger, startMetricsSummaryLogger, incMetric } from '@zeffuro/fakegaming-common';
import { startHealthServer } from './utils/healthServer.js';
import { startGameNightExpiryRuntime } from './modules/game-night/shared/gameNightRuntime.js';
import { voiceChannelOccupancyRuntime } from './modules/general/shared/voiceChannelOccupancyRuntime.js';
import {resolveInteractionOutputLocale} from './core/localization.js';

const {__dirname} = bootstrapEnv(import.meta.url);

const logger = getLogger({ name: 'bot' });

function isUnknownInteractionError(error: unknown): boolean {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && (error as { code?: unknown }).code === 10062;
}

function isExecutableCommandInteraction(interaction: Interaction): interaction is ExecutableCommandInteraction {
    return interaction.isChatInputCommand()
        || interaction.isUserContextMenuCommand()
        || interaction.isMessageContextMenuCommand();
}

(async () => {
    try {
        // Start minimal periodic metrics summary logger
        startMetricsSummaryLogger({ service: 'bot', loggerName: 'bot:metrics' });

        const healthPortEnv = process.env.BOT_HEALTH_PORT ?? '';
        const parsedPort = Number.parseInt(healthPortEnv, 10);
        const healthPort = Number.isFinite(parsedPort) && parsedPort >= 0 ? parsedPort : 0;
        const healthHost = process.env.BOT_HEALTH_HOST ?? '127.0.0.1';
        // Fire-and-forget start of health server will happen after client is created

        if (!process.env.DISCORD_BOT_TOKEN) {
            logger.error('DISCORD_BOT_TOKEN is not set in environment variables.');
            process.exit(1);
        }

        await deployCommandsAtStartup(deployCommands, logger);

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
                GatewayIntentBits.GuildVoiceStates,
            ]
        });

        client.on(Events.Error, (error) => {
            logger.error({ err: error }, 'Discord client emitted an error');
        });

        const modulesPath = path.join(__dirname, 'modules');

        try {
            await loadCommands(client, modulesPath);
        } catch (err) {
            logger.error({ err }, 'Error loading commands:');
            process.exit(1);
        }
        const componentRouter = new ComponentRouter(client.commands);

        // Now that the client exists, bind it to the health server
        void startHealthServer({ client, port: healthPort, host: healthHost, logger });

        client.once('clientReady', async () => {
            logger.info({ user: client.user?.tag }, `Logged in as ${client.user?.tag}`);
            try {
                await startGameNightExpiryRuntime(client);
            } catch (error) {
                logger.warn({ err: error }, 'Failed to restore Game Night Board expiry timers');
            }
            try {
                const configs = await getConfigManager().voiceChannelOccupancyConfigManager.listConfiguredGuilds();
                const restored = await voiceChannelOccupancyRuntime.start(client, configs);
                logger.info({ configured: configs.length, ...restored }, 'Voice channel occupancy runtime started');
            } catch (error) {
                logger.warn({ err: error }, 'Failed to restore occupied voice channels');
            }
        });


        client.on(Events.InteractionCreate, async (interaction: Interaction) => {
            if (interaction.isButton()) {
                try {
                    const handled = await componentRouter.dispatch(interaction);
                    if (handled) return;
                } catch (error) {
                    incMetric('component_error', { name: componentNamespace(interaction.customId) });
                    logger.error({ err: error, customId: interaction.customId }, 'Error handling component interaction');
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            const locale = await resolveInteractionOutputLocale(interaction);
                            await interaction.reply({
                                content: runtimeText(locale, "core", "errorHandlingInteraction"),
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    } catch (err) {
                        logger.error({ err }, 'Failed to send component error reply:');
                    }
                    return;
                }
                return;
            }

            if (!isExecutableCommandInteraction(interaction) && !interaction.isAutocomplete()) return;
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            if (interaction.isAutocomplete() && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    if (isUnknownInteractionError(error)) {
                        logger.debug({ err: error, command: interaction.commandName }, 'Autocomplete interaction expired before response');
                        return;
                    }

                    incMetric('autocomplete_error', { name: interaction.commandName });
                    logger.warn({ err: error, command: interaction.commandName }, 'Error handling autocomplete interaction');
                }
                return;
            }
            if (!isExecutableCommandInteraction(interaction)) return;
            const locale = await resolveInteractionOutputLocale(interaction);

            // Enforce per-guild DisabledModuleConfig before executing
            const guildId = interaction.guildId ?? '';
            if (guildId && command.moduleName) {
                try {
                    const moduleDisabled = await getConfigManager().disabledModuleManager.isModuleDisabled(guildId, command.moduleName);
                    if (moduleDisabled) {
                        await interaction.reply({
                            content: runtimeText(locale, 'core', 'theModuleIsDisabledForThisServer', {module: command.moduleName}),
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                } catch (err) {
                    logger.warn({ err, guildId, command: interaction.commandName, module: command.moduleName }, 'Failed to check disabled module config');
                }
            }

            // Enforce per-guild DisabledCommandConfig before executing
            if (guildId) {
                try {
                    const disabled = await getConfigManager().disabledCommandManager.isCommandDisabled(guildId, interaction.commandName);
                    if (disabled) {
                        await interaction.reply({
                            content: runtimeText(locale, "core", "thisCommandIsDisabledForThisServer"),
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                } catch (err) {
                    logger.warn({ err, guildId, command: interaction.commandName }, 'Failed to check disabled command config');
                }
            }

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
                            content: runtimeText(locale, "core", "errorExecutingCommand"),
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        await interaction.editReply({content: runtimeText(locale, "core", "errorExecutingCommand")});
                    }
                } catch (err) {
                    logger.error({ err }, 'Failed to send error reply:');
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

            logger.error({ stack: new Error('Catch location stack trace').stack }, 'Catch location stack trace');
        }
        process.exit(1);
    }
})();

export {FakegamingBot};
