import { DEFAULT_OUTPUT_LOCALE } from '@zeffuro/fakegaming-common';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    type ButtonInteraction,
} from 'discord.js';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import {
    isSupportedOutputLocale,
    resolveInteractionOutputLocale,
    type SupportedOutputLocale,
} from '../../../core/localization.js';
import { question as META } from '../commands.manifest.js';
import { questionCategoryCopyKey, translateQuestion } from '../data/questionCopy.js';
import { ENGLISH_QUESTION_PROMPTS } from '../data/questions.en.js';
import { DUTCH_QUESTION_PROMPTS } from '../data/questions.nl.js';
import {
    QuestionDeck,
    isQuestionCategorySelection,
    validateQuestionDataset,
    validateQuestionDatasetParity,
    type QuestionCategorySelection,
    type QuestionPrompt,
} from '../shared/questionDeck.js';

const englishPrompts = validateQuestionDataset(ENGLISH_QUESTION_PROMPTS);
const dutchPrompts = validateQuestionDataset(DUTCH_QUESTION_PROMPTS);
validateQuestionDatasetParity(englishPrompts, dutchPrompts);

const questionDecks: Readonly<Record<SupportedOutputLocale, QuestionDeck>> = {
    en: new QuestionDeck(englishPrompts),
    nl: new QuestionDeck(dutchPrompts),
};

const data = createSlashCommand(META, (builder: SlashCommandBuilder) =>
    builder
        .addStringOption(option => option
            .setName('category')
            .setDescription('Choose a question category')
            .setRequired(false)
            .addChoices(
                questionChoice('any'), questionChoice('gaming'), questionChoice('silly'),
                questionChoice('would-you-rather'), questionChoice('getting-to-know-you'), questionChoice('deep'),
            ))
        .addBooleanOption(option => option
            .setName('private')
            .setDescription('Show the question only to you')
            .setRequired(false))
);

function questionChoice(category: QuestionCategorySelection) {
    const key = questionCategoryCopyKey(category);
    return {
        name: translateQuestion('en', key),
        value: category,
    };
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveQuestionOutputLocale(interaction);
    const rawCategory = interaction.options.getString('category') ?? 'any';
    if (!isQuestionCategorySelection(rawCategory)) {
        await interaction.reply({
            content: translateQuestion(locale, 'categoryUnavailable'),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    const privateResponse = interaction.options.getBoolean('private') ?? false;
    const prompt = questionDecks[locale].draw(rawCategory, questionScopeKey(interaction, privateResponse));
    if (!prompt) {
        await interaction.reply({
            content: translateQuestion(locale, 'questionsUnavailable'),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        return;
    }

    await interaction.reply({
        ...buildQuestionMessage(prompt, rawCategory, privateResponse, locale),
        ...(privateResponse ? { flags: MessageFlags.Ephemeral } : {}),
    });
}

export function createQuestionComponentHandler(
    getDeck: (locale: SupportedOutputLocale) => QuestionDeck,
): (interaction: ButtonInteraction) => Promise<boolean> {
    return async (interaction: ButtonInteraction): Promise<boolean> => {
        const parts = interaction.customId.split(':');
        if (parts[0] !== 'question') return false;

        const selection = parts[2];
        const visibility = parts[3];
        const locale = parts.length === 5 ? parts[4] : DEFAULT_OUTPUT_LOCALE;
        if ((parts.length !== 4 && parts.length !== 5)
            || parts[1] !== 'next'
            || !isQuestionCategorySelection(selection)
            || (visibility !== 'public' && visibility !== 'private')
            || !isSupportedOutputLocale(locale)) {
            return await replyUnavailable(interaction, await resolveQuestionOutputLocale(interaction));
        }

        const privateResponse = visibility === 'private';
        const prompt = getDeck(locale).draw(selection, questionScopeKey(interaction, privateResponse));
        if (!prompt) return await replyUnavailable(interaction, locale);

        await interaction.update(buildQuestionMessage(prompt, selection, privateResponse, locale));
        return true;
    };
}

export async function resolveQuestionOutputLocale(
    interaction: Pick<ChatInputCommandInteraction | ButtonInteraction, 'guildId' | 'locale'>,
    getStoredGuildLocale?: (guildId: string) => Promise<unknown>,
): Promise<SupportedOutputLocale> {
    return await resolveInteractionOutputLocale(interaction, getStoredGuildLocale);
}

export function buildQuestionMessage(
    prompt: QuestionPrompt,
    selection: QuestionCategorySelection,
    privateResponse: boolean,
    locale: SupportedOutputLocale = DEFAULT_OUTPUT_LOCALE,
) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(translateQuestion(locale, 'title'))
        .setDescription(prompt.text)
        .setFooter({
            text: translateQuestion(locale, 'categoryFooter', {
                category: translateQuestion(locale, questionCategoryCopyKey(prompt.category)),
            }),
        });
    const button = new ButtonBuilder()
        .setCustomId(`question:next:${selection}:${privateResponse ? 'private' : 'public'}:${locale}`)
        .setLabel(translateQuestion(locale, 'anotherQuestion'))
        .setStyle(ButtonStyle.Primary);

    return {
        embeds: [embed],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
        allowedMentions: { parse: [] as [] },
    };
}

function questionScopeKey(
    interaction: Pick<ChatInputCommandInteraction | ButtonInteraction, 'channelId' | 'user'>,
    privateResponse: boolean,
): string {
    return privateResponse ? `user:${interaction.user.id}` : `channel:${interaction.channelId}`;
}

async function replyUnavailable(interaction: ButtonInteraction, locale: SupportedOutputLocale): Promise<boolean> {
    await interaction.reply({
        content: translateQuestion(locale, 'buttonUnavailable'),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    });
    return true;
}

const handleComponent = createQuestionComponentHandler(locale => questionDecks[locale]);
const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default { data, execute, testOnly, handleComponent };
