import { resolveLocaleValue } from '@zeffuro/fakegaming-common';
import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, type GuildMember } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { parseStoredQuoteTags } from '@zeffuro/fakegaming-common/utils';
import { buildQuoteCardFilename, renderQuoteCard } from '@zeffuro/fakegaming-common/quote-card';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { quoteCard as META } from '../commands.manifest.js';
import {resolveInteractionOutputLocale, type SupportedOutputLocale} from '../../../core/localization.js';

interface QuoteCardRow {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp?: number | string | null;
    tags?: unknown;
    source?: string | null;
    context?: string | null;
    moderationStatus?: string | null;
}

const data = createSlashCommand(META, (builder: SlashCommandBuilder) => {
    builder.addStringOption(option => option
        .setName('id')
        .setNameLocalization('nl', 'id')
        .setDescription('Quote ID or short ID. Leave empty for a random approved quote.')
        .setDescriptionLocalization('nl', 'Citaat-ID of verkort ID. Laat leeg voor een willekeurig goedgekeurd citaat.')
        .setRequired(false));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const locale = await resolveInteractionOutputLocale(interaction);
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: resolveLocaleValue(locale, { en: 'Quote cards only work in a server.', nl: 'Citaatkaarten werken alleen op een server.' }), flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const idInput = interaction.options.getString('id')?.trim().toLowerCase() ?? '';
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(guildId) as unknown as QuoteCardRow[];
    const quote = idInput ? findQuoteByIdInput(quotes, idInput, locale) : pickRandomApprovedQuote(quotes);

    if (typeof quote === 'string') {
        await interaction.editReply(quote);
        return;
    }

    if (!quote) {
        await interaction.editReply(resolveLocaleValue(locale, { en: idInput ? 'Quote not found in this server.' : 'No approved quotes found for this server.', nl: idInput ? 'Citaat niet gevonden op deze server.' : 'Geen goedgekeurde citaten gevonden op deze server.' }));
        return;
    }

    if (normalizeQuoteModerationStatus(quote.moderationStatus) !== 'approved') {
        await interaction.editReply(resolveLocaleValue(locale, { en: 'That quote is not approved yet. Approve it before rendering a card.', nl: 'Dat citaat is nog niet goedgekeurd. Keur het goed voordat je een kaart maakt.' }));
        return;
    }

    const [authorName, submitterName] = await Promise.all([
        resolveDisplayName(interaction, quote.authorId, locale),
        resolveDisplayName(interaction, quote.submitterId, locale),
    ]);
    const cardInput = {
        quote: quote.quote,
        authorName,
        authorId: quote.authorId,
        submitterName,
        timestamp: quote.timestamp,
        tags: parseStoredQuoteTags(quote.tags),
        source: normalizeOptionalText(quote.source),
        context: normalizeOptionalText(quote.context),
        guildName: interaction.guild?.name ?? null,
    };
    const buffer = resolveLocaleValue(locale, { en: renderQuoteCard(cardInput), nl: renderQuoteCard(cardInput, { locale }) });
    const attachment = new AttachmentBuilder(buffer, { name: buildQuoteCardFilename(quote.id) });

    await interaction.editReply({
        content: resolveLocaleValue(locale, { en: `Quote card for <@${quote.authorId}>`, nl: `Citaatkaart voor <@${quote.authorId}>` }),
        files: [attachment],
    });
}

function findQuoteByIdInput(quotes: readonly QuoteCardRow[], input: string, locale: SupportedOutputLocale): QuoteCardRow | string | null {
    const matches = quotes.filter(quote => {
        const id = quote.id.toLowerCase();
        return id === input || id.startsWith(input);
    });
    if (matches.length > 1) return resolveLocaleValue(locale, { en: 'That short quote ID matches multiple quotes. Use more characters from the ID.', nl: 'Dat verkorte citaat-ID komt overeen met meerdere citaten. Gebruik meer tekens van het ID.' });
    return matches[0] ?? null;
}

function pickRandomApprovedQuote(quotes: readonly QuoteCardRow[]): QuoteCardRow | null {
    const approved = quotes.filter(quote => normalizeQuoteModerationStatus(quote.moderationStatus) === 'approved');
    if (approved.length === 0) return null;
    return approved[Math.floor(Math.random() * approved.length)] ?? null;
}

async function resolveDisplayName(interaction: ChatInputCommandInteraction, userId: string, locale: SupportedOutputLocale): Promise<string> {
    const cached = interaction.guild?.members.cache.get(userId);
    if (cached) return cached.displayName;

    try {
        const fetched = await interaction.guild?.members.fetch(userId) as GuildMember | undefined;
        if (fetched?.displayName) return fetched.displayName;
    } catch {
        // Fall back to a stable label if the member cannot be fetched.
    }

    return `${resolveLocaleValue(locale, { en: 'Discord user', nl: 'Discord-gebruiker' })} ${userId.slice(-6)}`;
}

function normalizeQuoteModerationStatus(value: string | null | undefined): string {
    return value === 'approved' || value === 'rejected' || value === 'pending' ? value : 'pending';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

const testOnly = getTestOnly(META);

export default { data, execute, testOnly };
