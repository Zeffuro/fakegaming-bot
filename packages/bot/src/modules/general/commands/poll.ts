import {
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type ButtonInteraction,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { isSupportedOutputLocale, resolveInteractionOutputLocale } from '../../../core/localization.js';
import { getGeneralCopy } from '../data/generalCopy.js';
import { poll as META } from '../commands.manifest.js';
import {
    POLL_DEFAULT_DURATION_MINUTES,
    POLL_MAX_DURATION_MINUTES,
    POLL_MIN_DURATION_MINUTES,
    PollError,
} from '@zeffuro/fakegaming-common/managers';
import { getPollRuntime, type PollRuntime } from '../shared/pollRuntime.js';

const MAX_OPTIONS = 5;
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LENGTH = 200;

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('question').setDescription('The poll question').setMaxLength(MAX_QUESTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option1').setDescription('Option 1').setMaxLength(MAX_OPTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option2').setDescription('Option 2').setMaxLength(MAX_OPTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option3').setDescription('Option 3').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addStringOption(option => option.setName('option4').setDescription('Option 4').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addStringOption(option => option.setName('option5').setDescription('Option 5').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addIntegerOption(option => option
            .setName('duration')
            .setDescription('Minutes before this poll closes (default: 10)')
            .setMinValue(POLL_MIN_DURATION_MINUTES)
            .setMaxValue(POLL_MAX_DURATION_MINUTES)
            .setRequired(false))
        .addBooleanOption(option => option.setName('multiple').setDescription('Allow selecting several options (click again to remove)').setRequired(false))
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).poll;
    const question = normalizePollQuestion(interaction.options.getString('question', true));
    if (!question) {
        await interaction.editReply(copy.questionRequired);
        return;
    }
    const options: string[] = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
        const opt = interaction.options.getString(`option${i}`);
        if (opt?.trim()) options.push(opt.trim());
    }
    if (options.length < 2) {
        await interaction.editReply(copy.twoOptions);
        return;
    }
    if (hasDuplicatePollOptions(options)) {
        await interaction.editReply(copy.unique);
        return;
    }
    const durationMinutes = interaction.options.getInteger('duration') ?? POLL_DEFAULT_DURATION_MINUTES;
    if (durationMinutes < POLL_MIN_DURATION_MINUTES || durationMinutes > POLL_MAX_DURATION_MINUTES) {
        await interaction.editReply(copy.duration(POLL_MIN_DURATION_MINUTES, POLL_MAX_DURATION_MINUTES));
        return;
    }
    try {
        const runtime = getPollRuntime();
        const message = await interaction.fetchReply();
        const session = await runtime.manager.create({
            guildId: interaction.guildId ?? `dm:${interaction.user.id}`, channelId: interaction.channelId, messageId: message.id,
            creatorId: interaction.user.id, question, options, durationMinutes,
            allowMultiple: interaction.options.getBoolean('multiple') ?? false, locale,
        });
        runtime.track(session);
        await runtime.refresh(session.id).catch(() => undefined);
    } catch (error) {
        if (error instanceof PollError) {
            await interaction.editReply(error.code === 'capacity' ? copy.capacity : copy.failure);
        } else {
            await interaction.editReply(copy.failure);
        }
    }
}

export function createPollComponentHandler(runtime: Pick<PollRuntime, 'manager' | 'track' | 'refresh'>): (interaction: ButtonInteraction) => Promise<boolean> {
    return async (interaction: ButtonInteraction): Promise<boolean> => {
        const parts = interaction.customId.split(':');
        if (parts[0] !== 'poll') return false;
        const action = parts[1];
        const pollId = parts[2];
        const encodedLocale = parts.at(-1);
        await interaction.deferUpdate();
        const locale = isSupportedOutputLocale(encodedLocale) ? encodedLocale : await resolveInteractionOutputLocale(interaction);
        const copy = getGeneralCopy(locale).poll;
        const validVote = action === 'vote' && (parts.length === 4 || parts.length === 5)
            && /^(0|[1-9]\d*)$/.test(parts[3] ?? '');
        const validClose = action === 'close' && (parts.length === 3 || parts.length === 4);
        if (!pollId || (!validVote && !validClose)) {
            return replyPrivate(interaction, copy.unavailable);
        }
        const scope = { guildId: interaction.guildId ?? `dm:${interaction.user.id}`, channelId: interaction.channelId, messageId: interaction.message.id };
        try {
            const board = validVote
                ? await runtime.manager.vote(pollId, scope, interaction.user.id, Number(parts[3]))
                : await runtime.manager.close(pollId, scope, interaction.user.id,
                    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ?? false);
            runtime.track(board);
            if (validClose) {
                // Rendering failures retain the durable final result for runtime recovery.
                await runtime.refresh(board.id).catch(() => undefined);
            } else if (board.allowMultiple) {
                await replyPrivate(interaction, copy.selected((board.votes.get(interaction.user.id) ?? []).length));
            }
            return true;
        } catch (error) {
            const content = error instanceof PollError
                ? error.code === 'closed' ? copy.closed : error.code === 'not-authorized' ? copy.creatorOrModerator : copy.unavailable
                : copy.failure;
            return replyPrivate(interaction, content);
        }
    };
}

export function hasDuplicatePollOptions(options: readonly string[]): boolean {
    const uniqueOptions = new Set(options.map(option => option.trim().normalize('NFKC').toLowerCase()));
    return uniqueOptions.size !== options.length;
}

export function normalizePollQuestion(question: string): string {
    return question.trim();
}

async function handleComponent(interaction: ButtonInteraction): Promise<boolean> {
    return createPollComponentHandler(getPollRuntime())(interaction);
}

async function replyPrivate(interaction: ButtonInteraction, content: string): Promise<boolean> {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return true;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, handleComponent };
