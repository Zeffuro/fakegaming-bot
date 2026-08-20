import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    type ButtonInteraction,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { isSupportedOutputLocale, resolveInteractionOutputLocale, type SupportedOutputLocale } from '../../../core/localization.js';
import { getGeneralCopy } from '../data/generalCopy.js';
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
        .addStringOption(option => option.setName('question').setNameLocalization('nl', 'vraag').setDescription('The poll question').setDescriptionLocalization('nl', 'De vraag van de peiling').setMaxLength(MAX_QUESTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option1').setNameLocalization('nl', 'optie1').setDescription('Option 1').setDescriptionLocalization('nl', 'Optie 1').setMaxLength(MAX_OPTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option2').setNameLocalization('nl', 'optie2').setDescription('Option 2').setDescriptionLocalization('nl', 'Optie 2').setMaxLength(MAX_OPTION_LENGTH).setRequired(true))
        .addStringOption(option => option.setName('option3').setNameLocalization('nl', 'optie3').setDescription('Option 3').setDescriptionLocalization('nl', 'Optie 3').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addStringOption(option => option.setName('option4').setNameLocalization('nl', 'optie4').setDescription('Option 4').setDescriptionLocalization('nl', 'Optie 4').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addStringOption(option => option.setName('option5').setNameLocalization('nl', 'optie5').setDescription('Option 5').setDescriptionLocalization('nl', 'Optie 5').setMaxLength(MAX_OPTION_LENGTH).setRequired(false))
        .addIntegerOption(option => option
            .setName('duration')
            .setNameLocalization('nl', 'duur')
            .setDescription('Minutes before this poll closes (default: 10)')
            .setDescriptionLocalization('nl', 'Minuten voordat de peiling sluit (standaard: 10)')
            .setMinValue(POLL_MIN_DURATION_MINUTES)
            .setMaxValue(POLL_MAX_DURATION_MINUTES)
            .setRequired(false))
);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const copy = getGeneralCopy(locale).poll;
    const question = normalizePollQuestion(interaction.options.getString('question', true));
    if (!question) {
        await interaction.reply(copy.questionRequired);
        return;
    }
    const options: string[] = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
        const opt = interaction.options.getString(`option${i}`);
        if (opt?.trim()) options.push(opt.trim());
    }
    if (options.length < 2) {
        await interaction.reply(copy.twoOptions);
        return;
    }
    if (hasDuplicatePollOptions(options)) {
        await interaction.reply(copy.unique);
        return;
    }
    const durationMinutes = interaction.options.getInteger('duration') ?? POLL_DEFAULT_DURATION_MINUTES;
    if (durationMinutes < POLL_MIN_DURATION_MINUTES || durationMinutes > POLL_MAX_DURATION_MINUTES) {
        await interaction.reply(copy.duration(POLL_MIN_DURATION_MINUTES, POLL_MAX_DURATION_MINUTES));
        return;
    }

    await interaction.reply({ content: copy.creating, allowedMentions: { parse: [] } });
    const pollMessage = await interaction.fetchReply();

    const session = pollSessions.create({
        creatorId: interaction.user.id,
        question,
        options,
        durationMinutes,
        message: pollMessage,
        locale,
    });
    if (!session) {
        await interaction.editReply(copy.capacity);
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
        const encodedLocale = parts.at(-1);
        const locale = isSupportedOutputLocale(encodedLocale) ? encodedLocale : await resolveInteractionOutputLocale(interaction);
        if (!pollId || !action) return await replyUnavailable(interaction, locale);

        if (action === 'vote') {
            if ((parts.length !== 4 && parts.length !== 5) || !/^(0|[1-9]\d*)$/.test(parts[3] ?? '')) {
                return await replyUnavailable(interaction, locale);
            }
            const optionIndex = Number(parts[3]);
            const result = pollStore.vote(pollId, interaction.user.id, optionIndex);
            if (result.status === 'missing') return await replyUnavailable(interaction, locale);
            if (result.status === 'closed') return await replyClosed(interaction, locale);

            await interaction.deferUpdate();
            return true;
        }

        if (action === 'close' && (parts.length === 3 || parts.length === 4)) {
            const result = pollStore.close(pollId, interaction.user.id);
            if (result.status === 'missing') return await replyUnavailable(interaction, locale);
            if (result.status === 'not-creator') {
                await interaction.reply({
                    content: getGeneralCopy(locale).poll.creatorOnly,
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] },
                });
                return true;
            }
            if (result.status === 'already-closed') return await replyClosed(interaction, locale);

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

        return await replyUnavailable(interaction, locale);
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

async function replyUnavailable(interaction: ButtonInteraction, locale: SupportedOutputLocale): Promise<boolean> {
    await interaction.reply({
        content: getGeneralCopy(locale).poll.unavailable,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    return true;
}

async function replyClosed(interaction: ButtonInteraction, locale: SupportedOutputLocale): Promise<boolean> {
    await interaction.reply({
        content: getGeneralCopy(locale).poll.closed,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    return true;
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, handleComponent };
