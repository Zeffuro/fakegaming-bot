import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, type GuildMember } from 'discord.js';
import { getConfigManager } from '@zeffuro/fakegaming-common/managers';
import { parseStoredQuoteTags } from '@zeffuro/fakegaming-common/utils';
import { buildQuoteCardFilename, renderQuoteCard } from '@zeffuro/fakegaming-common/quote-card';
import { createSlashCommand, getTestOnly } from '../../../core/commandBuilder.js';
import { quoteCard as META } from '../commands.manifest.js';

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
        .setDescription('Quote ID or short ID. Leave empty for a random approved quote.')
        .setRequired(false));
});

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'Quote cards only work in a server.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply();

    const idInput = interaction.options.getString('id')?.trim().toLowerCase() ?? '';
    const quotes = await getConfigManager().quoteManager.getQuotesByGuild(guildId) as unknown as QuoteCardRow[];
    const quote = idInput ? findQuoteByIdInput(quotes, idInput) : pickRandomApprovedQuote(quotes);

    if (typeof quote === 'string') {
        await interaction.editReply(quote);
        return;
    }

    if (!quote) {
        await interaction.editReply(idInput ? 'Quote not found in this server.' : 'No approved quotes found for this server.');
        return;
    }

    if (normalizeQuoteModerationStatus(quote.moderationStatus) !== 'approved') {
        await interaction.editReply('That quote is not approved yet. Approve it before rendering a card.');
        return;
    }

    const [authorName, submitterName] = await Promise.all([
        resolveDisplayName(interaction, quote.authorId),
        resolveDisplayName(interaction, quote.submitterId),
    ]);
    const buffer = renderQuoteCard({
        quote: quote.quote,
        authorName,
        authorId: quote.authorId,
        submitterName,
        timestamp: quote.timestamp,
        tags: parseStoredQuoteTags(quote.tags),
        source: normalizeOptionalText(quote.source),
        context: normalizeOptionalText(quote.context),
        guildName: interaction.guild?.name ?? null,
    });
    const attachment = new AttachmentBuilder(buffer, { name: buildQuoteCardFilename(quote.id) });

    await interaction.editReply({
        content: `Quote card for <@${quote.authorId}>`,
        files: [attachment],
    });
}

function findQuoteByIdInput(quotes: readonly QuoteCardRow[], input: string): QuoteCardRow | string | null {
    const matches = quotes.filter(quote => {
        const id = quote.id.toLowerCase();
        return id === input || id.startsWith(input);
    });
    if (matches.length > 1) return 'That short quote ID matches multiple quotes. Use more characters from the ID.';
    return matches[0] ?? null;
}

function pickRandomApprovedQuote(quotes: readonly QuoteCardRow[]): QuoteCardRow | null {
    const approved = quotes.filter(quote => normalizeQuoteModerationStatus(quote.moderationStatus) === 'approved');
    if (approved.length === 0) return null;
    return approved[Math.floor(Math.random() * approved.length)] ?? null;
}

async function resolveDisplayName(interaction: ChatInputCommandInteraction, userId: string): Promise<string> {
    const cached = interaction.guild?.members.cache.get(userId);
    if (cached) return cached.displayName;

    try {
        const fetched = await interaction.guild?.members.fetch(userId) as GuildMember | undefined;
        if (fetched?.displayName) return fetched.displayName;
    } catch {
        // Fall back to a stable label if the member cannot be fetched.
    }

    return `Discord user ${userId.slice(-6)}`;
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
