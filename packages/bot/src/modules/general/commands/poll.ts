import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    type ButtonInteraction,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { poll as META } from '../commands.manifest.js';
import {
    POLL_DEFAULT_DURATION_MINUTES,
    POLL_MAX_DURATION_MINUTES,
    POLL_MIN_DURATION_MINUTES,
    PollSessionStore,
    renderPollMessage,
} from '../shared/pollSession.js';

const MAX_OPTIONS = 5;
const MAX_QUESTION_LENGTH = 200;
const MAX_OPTION_LENGTH = 200;
const pollSessions = new PollSessionStore();

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
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = normalizePollQuestion(interaction.options.getString('question', true));
    if (!question) {
        await interaction.reply('Please provide a poll question.');
        return;
    }
    const options: string[] = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
        const opt = interaction.options.getString(`option${i}`);
        if (opt?.trim()) options.push(opt.trim());
    }
    if (options.length < 2) {
        await interaction.reply('Please provide at least two options for the poll.');
        return;
    }
    if (hasDuplicatePollOptions(options)) {
        await interaction.reply('Poll options must be unique.');
        return;
    }
    const durationMinutes = interaction.options.getInteger('duration') ?? POLL_DEFAULT_DURATION_MINUTES;
    if (durationMinutes < POLL_MIN_DURATION_MINUTES || durationMinutes > POLL_MAX_DURATION_MINUTES) {
        await interaction.reply(`Duration must be between ${POLL_MIN_DURATION_MINUTES} and ${POLL_MAX_DURATION_MINUTES} minutes.`);
        return;
    }

    await interaction.reply({ content: 'Creating poll...', allowedMentions: { parse: [] } });
    const pollMessage = await interaction.fetchReply();

    const session = pollSessions.create({
        creatorId: interaction.user.id,
        question,
        options,
        durationMinutes,
        message: pollMessage,
    });
    if (!session) {
        await interaction.editReply('Too many active polls are already running. Please try again shortly.');
        return;
    }

    await interaction.editReply(renderPollMessage(session));
}

export function createPollComponentHandler(pollStore: PollSessionStore): (interaction: ButtonInteraction) => Promise<boolean> {
    return async (interaction: ButtonInteraction): Promise<boolean> => {
        const parts = interaction.customId.split(':');
        if (parts[0] !== 'poll') return false;

        const action = parts[1];
        const pollId = parts[2];
        if (!pollId || !action) return await replyUnavailable(interaction);

        if (action === 'vote') {
            if (parts.length !== 4 || !/^(0|[1-9]\d*)$/.test(parts[3] ?? '')) {
                return await replyUnavailable(interaction);
            }
            const optionIndex = Number(parts[3]);
            const result = pollStore.vote(pollId, interaction.user.id, optionIndex);
            if (result.status === 'missing') return await replyUnavailable(interaction);
            if (result.status === 'closed') return await replyClosed(interaction);

            await interaction.deferUpdate();
            return true;
        }

        if (action === 'close' && parts.length === 3) {
            const result = pollStore.close(pollId, interaction.user.id);
            if (result.status === 'missing') return await replyUnavailable(interaction);
            if (result.status === 'not-creator') {
                await interaction.reply({
                    content: 'Only the poll creator can close this poll.',
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] },
                });
                return true;
            }
            if (result.status === 'already-closed') return await replyClosed(interaction);

            await interaction.deferUpdate();
            if (result.session) {
                try {
                    await pollStore.renderNow(result.session);
                } catch {
                    // The session is closed even when Discord no longer permits editing its message.
                }
            }
            return true;
        }

        return await replyUnavailable(interaction);
    };
}

export function hasDuplicatePollOptions(options: readonly string[]): boolean {
    const uniqueOptions = new Set(options.map(option => option.trim().normalize('NFKC').toLowerCase()));
    return uniqueOptions.size !== options.length;
}

export function normalizePollQuestion(question: string): string {
    return question.trim();
}

const handleComponent = createPollComponentHandler(pollSessions);

async function replyUnavailable(interaction: ButtonInteraction): Promise<boolean> {
    await interaction.reply({
        content: 'This poll is no longer available. It may have expired or the bot restarted.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    return true;
}

async function replyClosed(interaction: ButtonInteraction): Promise<boolean> {
    await interaction.reply({
        content: 'This poll is closed.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    return true;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, handleComponent };
