/**
 * Configuration for a quote in a Discord guild.
 * - id: The unique ID of the quote.
 * - guildId: The Discord guild ID where the quote is stored.
 * - quote: The quote text.
 * - authorId: The Discord user ID of the quote's author.
 * - submitterId: The Discord user ID of the person who submitted the quote.
 * - timestamp: The timestamp when the quote was added.
 */
export type QuoteConfig = {
    id: string;
    guildId: string;
    quote: string;
    authorId: string;
    submitterId: string;
    timestamp: number;
};