import {
    MessageFlags,
    SlashCommandBuilder,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
} from 'discord.js';
import {
    GAME_NIGHT_DEFAULT_DURATION_HOURS,
    GAME_NIGHT_MAX_DURATION_HOURS,
    GAME_NIGHT_MAX_NAME_LENGTH,
    GAME_NIGHT_MIN_DURATION_HOURS,
    GameNightError,
    type GameNightBoard,
    type GameNightManager,
} from '@zeffuro/fakegaming-common';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { isSupportedOutputLocale, resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { gameNight as META } from '../commands.manifest.js';
import { getGameNightCopy } from '../copy/gameNightCopy.js';
import { renderGameNightBoard } from '../shared/gameNightPresentation.js';
import {
    cancelGameNightExpiry,
    cancelGameNightRefresh,
    queueGameNightRefresh,
    refreshGameNightMessage,
    scheduleGameNightExpiry,
} from '../shared/gameNightRuntime.js';

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => {
    const english = getGameNightCopy('en');
    const dutch = getGameNightCopy('nl');
    builder
        .setDMPermission(false)
        .addSubcommand(command => command
            .setName('start')
            .setNameLocalization('nl', 'starten')
            .setDescription(english.command.start)
            .setDescriptionLocalization('nl', dutch.command.start)
            .addStringOption(option => option
                .setName('name')
                .setNameLocalization('nl', 'naam')
                .setDescription(english.command.startName)
                .setDescriptionLocalization('nl', dutch.command.startName)
                .setMaxLength(GAME_NIGHT_MAX_NAME_LENGTH)
                .setRequired(true))
            .addIntegerOption(option => option
                .setName('duration')
                .setNameLocalization('nl', 'duur')
                .setDescription(english.command.duration)
                .setDescriptionLocalization('nl', dutch.command.duration)
                .setMinValue(GAME_NIGHT_MIN_DURATION_HOURS)
                .setMaxValue(GAME_NIGHT_MAX_DURATION_HOURS)))
        .addSubcommand(command => command
            .setName('nominate')
            .setNameLocalization('nl', 'nomineren')
            .setDescription(english.command.nominate)
            .setDescriptionLocalization('nl', dutch.command.nominate)
            .addStringOption(option => option
                .setName('game')
                .setNameLocalization('nl', 'spel')
                .setDescription(english.command.game)
                .setDescriptionLocalization('nl', dutch.command.game)
                .setMaxLength(GAME_NIGHT_MAX_NAME_LENGTH)
                .setRequired(true)))
        .addSubcommand(command => command.setName('open').setNameLocalization('nl', 'openen').setDescription(english.command.open).setDescriptionLocalization('nl', dutch.command.open))
        .addSubcommand(command => command.setName('close').setNameLocalization('nl', 'sluiten').setDescription(english.command.close).setDescriptionLocalization('nl', dutch.command.close))
        .addSubcommand(command => command.setName('status').setNameLocalization('nl', 'status').setDescription(english.command.status).setDescriptionLocalization('nl', dutch.command.status));
});

export interface GameNightRuntimeActions {
    queueRefresh: typeof queueGameNightRefresh;
}

export function createGameNightHandlers(
    manager: GameNightManager,
    runtime: GameNightRuntimeActions = { queueRefresh: queueGameNightRefresh },
): {
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    handleComponent: (interaction: ButtonInteraction) => Promise<boolean>;
} {
    return {
        execute: async interaction => {
            const locale = await resolveInteractionOutputLocale(interaction);
            const gameNightCopy = getGameNightCopy(locale);
            if (!interaction.guildId || !interaction.channelId) {
                await interaction.reply({ content: gameNightCopy.guildOnly, flags: MessageFlags.Ephemeral });
                return;
            }
            try {
                const subcommand = interaction.options.getSubcommand();
                if (subcommand === 'start') {
                    const board = await manager.start({
                        guildId: interaction.guildId,
                        channelId: interaction.channelId,
                        creatorId: interaction.user.id,
                        name: interaction.options.getString('name', true),
                        durationHours: interaction.options.getInteger('duration') ?? GAME_NIGHT_DEFAULT_DURATION_HOURS,
                    });
                    try {
                        await interaction.reply(renderGameNightBoard(board, locale));
                        const message = await interaction.fetchReply();
                        await manager.attachMessage(board.session.id, message.id);
                        const attached = await manager.getById(board.session.id);
                        if (attached) scheduleGameNightExpiry(interaction.client, attached);
                    } catch (error) {
                        await manager.expire(board.session.id);
                        throw error;
                    }
                    return;
                }

                const active = await manager.getActive(interaction.guildId);
                if (!active) throw new GameNightError('not-found');
                if (active.session.channelId !== interaction.channelId) throw new GameNightError('wrong-channel');

                if (subcommand === 'nominate') {
                    const board = await manager.nominate({
                        guildId: interaction.guildId,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        gameName: interaction.options.getString('game', true),
                    });
                    await interaction.reply({
                        content: gameNightCopy.nominated(findNominationForUser(board, interaction.user.id)?.gameName ?? ''),
                        flags: MessageFlags.Ephemeral,
                        allowedMentions: { parse: [] },
                    });
                    await refreshGameNightMessage(interaction.client, board, locale);
                    return;
                }
                if (subcommand === 'open') {
                    const board = await manager.openVoting(active.session.id, interaction.user.id);
                    await interaction.reply({ content: gameNightCopy.votingOpened, flags: MessageFlags.Ephemeral });
                    await refreshGameNightMessage(interaction.client, board, locale);
                    return;
                }
                if (subcommand === 'close') {
                    const board = await manager.close(active.session.id, interaction.user.id);
                    cancelGameNightExpiry(active.session.id);
                    cancelGameNightRefresh(active.session.id);
                    await interaction.reply({ content: gameNightCopy.closed, flags: MessageFlags.Ephemeral });
                    await refreshGameNightMessage(interaction.client, board, locale);
                    return;
                }
                const rendered = renderGameNightBoard(active, locale);
                await interaction.reply({ ...rendered, components: [], flags: MessageFlags.Ephemeral });
            } catch (error) {
                await replyWithGameNightError(interaction, error, locale);
            }
        },
        handleComponent: async interaction => {
            const parts = interaction.customId.split(':');
            if (parts[0] !== 'game-night') return false;
            const action = parts[1];
            const sessionId = parts[2];
            const encodedLocale = parts.at(-1);
            const locale = isSupportedOutputLocale(encodedLocale)
                ? encodedLocale
                : await resolveInteractionOutputLocale(interaction);
            const gameNightCopy = getGameNightCopy(locale);
            if (!action || !sessionId) {
                await interaction.reply({ content: gameNightCopy.unavailable, flags: MessageFlags.Ephemeral });
                return true;
            }
            try {
                let board: GameNightBoard;
                if (action === 'open' && (parts.length === 3 || parts.length === 4)) {
                    board = await manager.openVoting(sessionId, interaction.user.id);
                } else if (action === 'close' && (parts.length === 3 || parts.length === 4)) {
                    board = await manager.close(sessionId, interaction.user.id);
                    cancelGameNightExpiry(sessionId);
                    cancelGameNightRefresh(sessionId);
                } else if (action === 'vote' && (parts.length === 4 || parts.length === 5) && parts[3]) {
                    board = await manager.vote(sessionId, interaction.user.id, parts[3]);
                    await interaction.deferUpdate();
                    runtime.queueRefresh(interaction.client, board);
                    return true;
                } else {
                    await interaction.reply({ content: gameNightCopy.unavailable, flags: MessageFlags.Ephemeral });
                    return true;
                }
                await interaction.update(renderGameNightBoard(board, locale));
                return true;
            } catch (error) {
                await replyWithGameNightError(interaction, error, locale);
                return true;
            }
        },
    };
}

export function findNominationForUser(board: GameNightBoard, userId: string) {
    return board.nominations.find(nomination => nomination.userId === userId);
}

async function replyWithGameNightError(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    error: unknown,
    locale: SupportedOutputLocale,
): Promise<void> {
    const gameNightCopy = getGameNightCopy(locale);
    const content = error instanceof GameNightError ? gameNightCopy.error(error.code) : gameNightCopy.unavailable;
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
}

const handlers = createGameNightHandlers(getConfigManager().gameNightManager);
const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute: handlers.execute, handleComponent: handlers.handleComponent, testOnly };
