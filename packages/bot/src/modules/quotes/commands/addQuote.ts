import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import {SlashCommandBuilder, ChatInputCommandInteraction} from 'discord.js';
import {getConfigManager} from '@zeffuro/fakegaming-common/managers';
import {v4 as uuidv4} from 'uuid';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { addQuote as META } from '../commands.manifest.js';
import {resolveInteractionOutputLocale} from '../../../core/localization.js';

const data = createSlashCommand(META, (b: SlashCommandBuilder) =>
    b
        .addStringOption(option => option.setName('quote').setNameLocalization('nl', 'citaat').setDescription('The quote text').setDescriptionLocalization('nl', 'De tekst van het citaat').setRequired(true))
        .addUserOption(option => option.setName('author').setNameLocalization('nl', 'auteur').setDescription('User who said the quote').setDescriptionLocalization('nl', 'Gebruiker die het citaat uitsprak').setRequired(true))
);

/**
 * Executes the add-quote command, adding a quote for a specified user.
 * Replies with a confirmation message.
 */
async function execute(interaction: ChatInputCommandInteraction) {
    const locale = await resolveInteractionOutputLocale(interaction);
    const quoteText = interaction.options.getString('quote', true);
    const author = interaction.options.getUser('author', true);
    const submitter = interaction.user;
    const guildId = interaction.guildId!;

    const { created } = await getConfigManager().quoteManager.upsertQuote({
        id: uuidv4(),       // generate new id if new quote
        guildId,
        quote: quoteText,
        authorId: author.id,
        submitterId: submitter.id,
        timestamp: Date.now(),
    });

    await interaction.reply(
        resolveLocaleValue(locale, { en: created
            ? `Quote added for ${author.tag}: "${quoteText}"`
            : `Quote updated for ${author.tag}: "${quoteText}"`, nl: `${created ? 'Citaat toegevoegd' : 'Citaat bijgewerkt'} voor ${author.tag}: "${quoteText}"` })
    );
}

const testOnly = getTestOnly(META);

// noinspection JSUnusedGlobalSymbols
export default {data, execute, testOnly};
